/**
 * NoteForge — Metin Servisi
 *
 * Anahtar `.env.local` içindeki VITE_GEMINI_API_KEY'den okunur.
 */

const API_KEY  = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? ''
const MODEL    = (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

/** Metin servisi kullanılabilir mi? (anahtar tanımlı mı) */
export function isAiConfigured(): boolean {
  return API_KEY.length > 0
}

export type AiErrorKind = 'config' | 'rate-limit' | 'network' | 'api'

export class AiError extends Error {
  kind: AiErrorKind

  constructor(message: string, kind: AiErrorKind = 'api') {
    super(message)
    this.name = 'AiError'
    this.kind = kind
  }
}

interface ApiPart { text?: string }
interface ApiResponse {
  candidates?: { content?: { parts?: ApiPart[] }; finishReason?: string }[]
  error?: { message?: string; status?: string }
}

interface GenerateOptions {
  system: string
  prompt: string
  maxOutputTokens?: number
  temperature?: number
  signal?: AbortSignal
}

async function generate({
  system,
  prompt,
  maxOutputTokens = 160,
  temperature = 0.7,
  signal,
}: GenerateOptions): Promise<string> {
  if (!API_KEY) {
    throw new AiError('API anahtarı tanımlı değil (VITE_GEMINI_API_KEY).', 'config')
  }

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type':   'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new AiError('Servise ulaşılamadı. Bağlantını kontrol et.', 'network')
  }

  if (!res.ok) {
    if (res.status === 429) throw new AiError('Kullanım limiti aşıldı. Biraz sonra tekrar dene.', 'rate-limit')
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AiError('API anahtarı geçersiz ya da yetkisiz.', 'config')
    }
    const body = (await res.json().catch(() => null)) as ApiResponse | null
    throw new AiError(body?.error?.message ?? `İstek başarısız (${res.status}).`, 'api')
  }

  const data = (await res.json()) as ApiResponse
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map(p => p.text ?? '')
    .join('')

  return text
}

/** Ghost-text tamamlaması için modelden dönen metni temizler. */
function cleanCompletion(raw: string): string {
  return raw
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/, '')
    .replace(/^["'“”]|["'“”]$/g, '')
    .replace(/\r/g, '')
    .split('\n')[0]          // ghost text tek satır olarak gösterilir
    .replace(/\s+/g, ' ')
    .trimEnd()
}

const COMPLETION_SYSTEM = [
  'Sen bir not alma uygulamasının satır içi yazı tamamlama motorusun.',
  'Kullanıcının yarım bıraktığı cümleyi DOĞAL biçimde devam ettir.',
  'Kurallar:',
  '- Sadece devam metnini yaz; kullanıcının yazdığını tekrarlama.',
  '- En fazla bir cümle, 20 kelimeyi geçme.',
  '- Kullanıcının dilini ve üslubunu koru (metin Türkçeyse Türkçe devam et).',
  '- Açıklama, tırnak, madde işareti, markdown veya ön ek ekleme.',
  '- Devam edecek anlamlı bir şey yoksa boş yanıt ver.',
].join('\n')

/**
 * İmleçten önceki metnin devamını önerir (ghost text).
 * @param before İmleçten önceki metin (son ~1000 karakter yeterlidir)
 */
export async function fetchCompletion(before: string, signal?: AbortSignal): Promise<string> {
  const context = before.slice(-1200)
  if (context.trim().length < 8) return ''

  const raw = await generate({
    system: COMPLETION_SYSTEM,
    prompt: `Aşağıdaki metni devam ettir:\n\n<<<${context}>>>`,
    maxOutputTokens: 96,
    temperature: 0.7,
    signal,
  })

  const text = cleanCompletion(raw)
  if (!text) return ''

  // Kullanıcı kelime ortasında değilse, öneriyi bir boşlukla başlat.
  const needsSpace = /\S$/.test(context) && !/^[\s.,;:!?…)\]}'"]/.test(text)
  return needsSpace ? ` ${text}` : text
}

export type AiAction = 'summarize' | 'rewrite' | 'continue' | 'shorten'

const ACTION_SYSTEM: Record<AiAction, string> = {
  summarize: 'Verilen metni aynı dilde, kısa ve net biçimde özetle. Sadece özeti yaz.',
  rewrite:   'Verilen metni aynı dilde ve aynı anlamı koruyarak daha akıcı, daha net biçimde yeniden yaz. Sadece yeni metni yaz.',
  continue:  'Verilen metni aynı dilde ve aynı üslupta 2-3 cümle devam ettir. Sadece devam metnini yaz, verilen metni tekrarlama.',
  shorten:   'Verilen metni aynı dilde, anlamı koruyarak belirgin şekilde kısalt. Sadece kısaltılmış metni yaz.',
}

/** Seçili metin üzerinde AI aksiyonu çalıştırır (özetle / yeniden yaz / devam ettir / kısalt). */
export async function runAiAction(action: AiAction, text: string, signal?: AbortSignal): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const raw = await generate({
    system: ACTION_SYSTEM[action],
    prompt: trimmed,
    maxOutputTokens: 600,
    temperature: action === 'summarize' || action === 'shorten' ? 0.3 : 0.6,
    signal,
  })

  return raw
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/, '')
    .trim()
}
