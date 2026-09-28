/**
 * NoteForge — Client-Side Export Engine
 *
 * All export formats are generated entirely in the browser — no backend needed.
 *
 * • Markdown (.md) — custom TipTap-JSON → Markdown traversal
 * • Plain Text (.txt) — strip formatting from markdown output
 * • DOCX (.docx) — `docx` npm package (pure JS, browser-compatible)
 * • PDF (.pdf) — styled HTML in a hidden iframe + print() (browser renders to PDF)
 *
 * Görseller notta metinden bağımsız bir katmanda durur. PDF bu katmanı
 * birebir yeniden kurar; akışlı formatlarda (md/txt/docx) her görsel,
 * notta denk geldiği bloğun ardına okuma sırasıyla eklenir.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType,
  type ParagraphChild,
} from 'docx'
import type { JSONContent } from '@tiptap/core'

/* ─── Görsel verisi ─────────────────────────────────────────── */
export interface ExportImage {
  url: string
  name: string
  /** px — metin sütununun (ProseMirror kökü) sol üst köşesine göre */
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  /** Bu görselin okuma sırasında ardına geleceği üst düzey blok (-1: en başa) */
  afterBlock: number
}

export interface ExportLayout {
  /** Metin sütununun genişliği (px) */
  textWidth: number
  /** Görsel katmanının metin sütunu dışına taşabildiği kenar boşlukları */
  padL: number
  padR: number
  padTop: number
  /** Notun üst kenarından metin sütununa kadar olan yükseklik (üst boşluk + başlık + bilgi satırı) */
  headerHeight: number
  /** Kullanıcı tercihleriyle belirlenen editör tipografisi (satır kırılmaları aynı olsun) */
  typography: { fontFamily: string; fontSize: number; lineHeight: number }
  /** Uygulamanın yüklediği yazı tipi stil sayfaları */
  fontLinks: string[]
}

export interface ExportExtras {
  images?: ExportImage[]
  layout?: ExportLayout
}

/** Blok konumlarından her görselin okuma sırasındaki yerini belirler. */
export function assignReadingOrder(
  images: Omit<ExportImage, 'afterBlock'>[],
  blocks: { top: number; bottom: number }[],
): ExportImage[] {
  return images.map(img => {
    let after = -1
    blocks.forEach((b, i) => {
      if ((b.top + b.bottom) / 2 <= img.y) after = i
    })
    return { ...img, afterBlock: after }
  })
}

/** Blokları ve görselleri okuma sırasında birleştirir. */
function interleave<T>(
  blocks: JSONContent[],
  images: ExportImage[],
  renderBlock: (n: JSONContent) => T[],
  renderImage: (img: ExportImage) => T[],
): T[] {
  const last = blocks.length - 1
  const groups = new Map<number, ExportImage[]>()
  for (const img of [...images].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const key = Math.min(img.afterBlock, last)
    groups.set(key, [...(groups.get(key) ?? []), img])
  }
  const out: T[] = (groups.get(-1) ?? []).flatMap(renderImage)
  blocks.forEach((b, i) => {
    out.push(...renderBlock(b))
    out.push(...(groups.get(i) ?? []).flatMap(renderImage))
  })
  return out
}

/* ─── Shared download helper ───────────────────────────────── */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Sanitise a note title for use as a filename */
function safeFilename(title: string): string {
  return title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')   // illegal chars
    .replace(/\s+/g, '-')             // spaces → dashes
    .replace(/-{2,}/g, '-')           // collapse dashes
    .slice(0, 80)                     // max 80 chars
    || 'not'
}

/* ═══════════════════════════════════════════════════════════════
   1. MARKDOWN  (.md)
   Traverses TipTap JSON and outputs a CommonMark markdown string.
   ═══════════════════════════════════════════════════════════════ */

function inlineToMd(node: JSONContent): string {
  if (node.type === 'hardBreak') return '  \n'
  if (node.type !== 'text') return ''

  let text = node.text ?? ''
  const marks = (node.marks ?? []).map((m: { type: string }) => m.type)

  // Order matters — bold before italic
  if (marks.includes('bold') && marks.includes('italic')) text = `***${text}***`
  else if (marks.includes('bold'))   text = `**${text}**`
  else if (marks.includes('italic')) text = `*${text}*`
  if (marks.includes('code'))        text = `\`${text}\``
  if (marks.includes('strike'))      text = `~~${text}~~`

  return text
}

function listItemToMd(node: JSONContent, ordered: boolean, idx: number): string {
  const prefix = ordered ? `${idx + 1}. ` : '- '
  const children = node.content ?? []
  // listItem wraps content in a paragraph
  const text = children
    .map((child: JSONContent) =>
      child.type === 'paragraph'
        ? (child.content ?? []).map(inlineToMd).join('')
        : nodeToMd(child)
    )
    .join('\n')
  return prefix + text
}

function nodeToMd(node: JSONContent): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(nodeToMd).join('\n')

    case 'heading': {
      const level  = (node.attrs?.level as number) ?? 1
      const hashes = '#'.repeat(level)
      const text   = (node.content ?? []).map(inlineToMd).join('')
      return `${hashes} ${text}`
    }

    case 'paragraph': {
      const text = (node.content ?? []).map(inlineToMd).join('')
      return text // blank line added by join('\n') between nodes
    }

    case 'bulletList':
      return (node.content ?? [])
        .map((li: JSONContent, i: number) => listItemToMd(li, false, i))
        .join('\n')

    case 'orderedList':
      return (node.content ?? [])
        .map((li: JSONContent, i: number) => listItemToMd(li, true, i))
        .join('\n')

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = (node.content ?? []).map((n: JSONContent) => n.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    case 'blockquote':
      return (node.content ?? [])
        .map((n: JSONContent) => '> ' + nodeToMd(n))
        .join('\n')

    case 'horizontalRule':
      return '---'

    case 'hardBreak':
      return '  \n'

    default:
      return (node.content ?? []).map(nodeToMd).join('\n')
  }
}

const mdAlt = (name: string) => name.replace(/[[\]]/g, '')

/** Üst düzey bloklar boş satırla ayrılır; tek satır sonu Markdown'da paragrafları birleştirir. */
function markdownBody(json: JSONContent, images: ExportImage[], renderImage: (img: ExportImage) => string) {
  return interleave<string>(
    json.content ?? [],
    images,
    n => [nodeToMd(n)],
    img => [renderImage(img)],
  ).join('\n\n')
}

export function noteToMarkdown(json: JSONContent, title: string, images: ExportImage[] = []): string {
  const body = markdownBody(json, images, img => `![${mdAlt(img.name)}](${encodeURI(img.url)})`)
  return `# ${title}\n\n${body}\n`
}

export async function exportAsMarkdown(json: JSONContent, title: string, extras: ExportExtras = {}) {
  const md   = noteToMarkdown(json, title, extras.images)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  triggerDownload(blob, `${safeFilename(title)}.md`)
}

/* ═══════════════════════════════════════════════════════════════
   2. PLAIN TEXT  (.txt)
   Strip markdown syntax from the markdown output.
   ═══════════════════════════════════════════════════════════════ */

export async function exportAsText(json: JSONContent, title: string, extras: ExportExtras = {}) {
  const images = extras.images ?? []
  // Görseller, markdown temizliğinden etkilenmeyen işaretlerle yer alır
  const body = markdownBody(json, images, img => `[[NF_IMG_${images.indexOf(img)}]]`)
  const md  = `# ${title}\n\n${body}\n`
  const txt = md
    .replace(/^#{1,6}\s+/gm, '')         // headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/~~([^~]+)~~/g, '$1')        // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, '')) // code
    .replace(/^>\s+/gm, '')              // blockquotes
    .replace(/^[-*+]\s+/gm, '• ')       // bullet lists
    .replace(/^\d+\.\s+/gm, '')         // ordered lists
    .replace(/^---$/gm, '─'.repeat(40)) // hr
    .replace(/  \n/g, '\n')             // hard breaks
    .replace(/\[\[NF_IMG_(\d+)\]\]/g, (_m, i: string) =>
      `[Görsel: ${images[Number(i)].name}]\n${images[Number(i)].url}`)
    .replace(/\n{3,}/g, '\n\n')         // collapse extra blank lines
    .trim()

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, `${safeFilename(title)}.txt`)
}

/* ═══════════════════════════════════════════════════════════════
   3. DOCX  (.docx)
   Uses the `docx` npm package (pure JS, works in browsers).
   ═══════════════════════════════════════════════════════════════ */

/** A4 + 1" kenar boşluğunda Word metin sütunu genişliği (px) */
const DOCX_TEXT_WIDTH = 600
const IMAGE_TIMEOUT = 20_000

/**
 * Görseli editörde göründüğü gibi (kırpma + saydamlık) PNG'ye çevirir.
 * Blob URL üzerinden çizilir ki tuval CORS yüzünden "kirlenmesin".
 */
async function renderImagePng(img: ExportImage): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const res = await fetch(img.url, { mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const objUrl = URL.createObjectURL(await res.blob())
  try {
    // decode() sekme arka plandayken hiç çözülmeyebilir; onload her durumda gelir
    const el = new Image()
    await new Promise<void>((resolve, reject) => {
      el.onload = () => resolve()
      el.onerror = () => reject(new Error('load'))
      el.src = objUrl
    })

    const nw = el.naturalWidth || img.width
    const nh = el.naturalHeight || img.height
    const scale = Math.min(2, Math.max(1, nw / img.width))
    const cw = Math.max(1, Math.round(img.width * scale))
    const ch = Math.max(1, Math.round(img.height * scale))

    // object-fit: cover
    const s  = Math.max(cw / nw, ch / nh)
    const dw = nw * s
    const dh = nh * s

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.globalAlpha = img.opacity
    ctx.drawImage(el, (cw - dw) / 2, (ch - dh) / 2, dw, dh)

    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('toBlob')
    return { data: await blob.arrayBuffer(), width: img.width, height: img.height }
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

/** px → twip (1 px = 15 twip, 96 dpi) */
function docxIndent(node: JSONContent) {
  const v = indentOf(node)
  return v ? { indent: { left: Math.round(v * 15) } } : {}
}

function inlineToDocxRuns(node: JSONContent): TextRun[] {
  if (node.type === 'hardBreak') return [new TextRun({ break: 1 })]
  if (node.type !== 'text') return []

  const text  = node.text ?? ''
  const marks = (node.marks ?? []).map((m: { type: string }) => m.type)

  return [new TextRun({
    text,
    bold:    marks.includes('bold'),
    italics: marks.includes('italic'),
    strike:  marks.includes('strike'),
    ...(marks.includes('code') ? { font: 'Courier New', size: 20 } : {}),
  })]
}

function listItemToDocxPara(
  node: JSONContent,
  ordered: boolean,
  idx: number,
): Paragraph {
  const runs: ParagraphChild[] = (node.content ?? []).flatMap((child: JSONContent) => {
    if (child.type === 'paragraph') {
      return (child.content ?? []).flatMap(inlineToDocxRuns)
    }
    return []
  })

  if (ordered) {
    // Ordered list via numbering — use bullet with text prefix for simplicity
    return new Paragraph({
      children: [new TextRun({ text: `${idx + 1}. ` }), ...runs],
      indent: { left: 720 },
    })
  }

  return new Paragraph({
    bullet: { level: 0 },
    children: runs,
  })
}

function nodeToDocxBlocks(node: JSONContent): Paragraph[] {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).flatMap(nodeToDocxBlocks)

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const headingMap: Record<number, string> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      }
      const runs = (node.content ?? []).flatMap(inlineToDocxRuns)
      return [new Paragraph({ heading: (headingMap[level] ?? HeadingLevel.HEADING_1) as any, children: runs, ...docxIndent(node) })]
    }

    case 'paragraph': {
      const runs = (node.content ?? []).flatMap(inlineToDocxRuns)
      return [new Paragraph({ children: runs, ...docxIndent(node) })]
    }

    case 'bulletList':
      return (node.content ?? []).map((li: JSONContent, i: number) =>
        listItemToDocxPara(li, false, i)
      )

    case 'orderedList':
      return (node.content ?? []).map((li: JSONContent, i: number) =>
        listItemToDocxPara(li, true, i)
      )

    case 'codeBlock': {
      const text = (node.content ?? []).map((n: JSONContent) => n.text ?? '').join('')
      // Split lines and make each a paragraph with monospace font
      return text.split('\n').map(line =>
        new Paragraph({
          children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18 })],
          shading:  { fill: 'F5F5F5' },
        })
      )
    }

    case 'blockquote': {
      const children = (node.content ?? []).flatMap(nodeToDocxBlocks)
      return children.map(para => {
        // Re-wrap with indentation and border
        return new Paragraph({
          children: (para as Paragraph & { root: unknown[] }).root?.slice(1).flatMap(
            (r: unknown) => r instanceof TextRun ? [r] : []
          ) ?? [],
          indent: { left: 720 },
          border: {
            left: { color: '4D8DFF', size: 12, space: 8, style: 'single' },
          },
        })
      })
    }

    case 'horizontalRule':
      return [new Paragraph({
        border: { bottom: { color: 'CCCCCC', size: 6, space: 1, style: 'single' } },
        children: [],
      })]

    default:
      return (node.content ?? []).flatMap(nodeToDocxBlocks)
  }
}

function imageAlignment(img: ExportImage, textWidth: number) {
  const cx = img.x + img.width / 2
  if (Math.abs(cx - textWidth / 2) < textWidth * 0.15) return AlignmentType.CENTER
  return cx < textWidth / 2 ? AlignmentType.LEFT : AlignmentType.RIGHT
}

export async function exportAsDocx(json: JSONContent, title: string, extras: ExportExtras = {}) {
  const images = extras.images ?? []
  const textWidth = extras.layout?.textWidth ?? DOCX_TEXT_WIDTH

  // Görselleri paralel hazırla; biri başarısız olur ya da takılırsa yerine not düş
  const rendered = await Promise.all(images.map(img => Promise.race([
    renderImagePng(img).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), IMAGE_TIMEOUT)),
  ])))
  const byImage = new Map(images.map((img, i) => [img, rendered[i]]))

  const children = interleave<Paragraph>(
    json.content ?? [],
    images,
    nodeToDocxBlocks,
    img => {
      const r = byImage.get(img)
      if (!r) {
        return [new Paragraph({
          children: [new TextRun({ text: `[Görsel eklenemedi: ${img.name}]`, italics: true, color: '888888' })],
        })]
      }
      // Sayfaya sığdır (editörde metin sütunundan geniş olabilir)
      const k = Math.min(1, DOCX_TEXT_WIDTH / r.width)
      return [new Paragraph({
        alignment: imageAlignment(img, textWidth),
        spacing: { before: 120, after: 120 },
        children: [new ImageRun({
          type: 'png',
          data: r.data,
          transformation: {
            width: Math.round(r.width * k),
            height: Math.round(r.height * k),
            ...(img.rotation ? { rotation: img.rotation } : {}),
          },
          altText: { name: img.name, description: img.name, title: img.name },
        })],
      })]
    },
  )

  const doc = new Document({
    creator:     'NoteForge',
    title:       title,
    description: 'Exported from NoteForge',
    sections: [{
      properties: {},
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title })] }),
        ...children,
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${safeFilename(title)}.docx`)
}

/* ═══════════════════════════════════════════════════════════════
   4. PDF  (.pdf)
   Converts TipTap JSON → styled HTML in a hidden iframe and opens the
   browser's print dialog → user saves as PDF.
   Tipografi editörle aynı tutulur ki serbest görseller metinde
   aynı yere denk gelsin.
   ═══════════════════════════════════════════════════════════════ */

function inlineToHtml(node: JSONContent): string {
  if (node.type === 'hardBreak') return '<br>'
  if (node.type !== 'text') return ''

  let text = escapeHtml(node.text ?? '')
  const marks = (node.marks ?? []).map((m: { type: string }) => m.type)

  if (marks.includes('bold'))   text = `<strong>${text}</strong>`
  if (marks.includes('italic')) text = `<em>${text}</em>`
  if (marks.includes('strike')) text = `<s>${text}</s>`
  if (marks.includes('code'))   text = `<code>${text}</code>`

  return text
}

/** "Tıkla ve yaz" girintisi (px) */
function indentOf(node: JSONContent): number {
  const v = Number(node.attrs?.indent)
  return Number.isFinite(v) && v > 0 ? v : 0
}

function indentStyle(node: JSONContent): string {
  const v = indentOf(node)
  return v ? ` style="padding-left:${v}px"` : ''
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function listItemToHtml(node: JSONContent): string {
  const text = (node.content ?? [])
    .map((child: JSONContent) =>
      child.type === 'paragraph'
        ? (child.content ?? []).map(inlineToHtml).join('')
        : nodeToHtml(child)
    )
    .join('')
  return `<li>${text}</li>`
}

function nodeToHtml(node: JSONContent): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(nodeToHtml).join('\n')

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const text  = (node.content ?? []).map(inlineToHtml).join('')
      return `<h${level}${indentStyle(node)}>${text}</h${level}>`
    }

    case 'paragraph': {
      const text = (node.content ?? []).map(inlineToHtml).join('')
      return `<p${indentStyle(node)}>${text || '<br>'}</p>`
    }

    case 'bulletList': {
      const items = (node.content ?? []).map(listItemToHtml).join('\n')
      return `<ul>${items}</ul>`
    }

    case 'orderedList': {
      const items = (node.content ?? []).map(listItemToHtml).join('\n')
      return `<ol>${items}</ol>`
    }

    case 'codeBlock': {
      const code = escapeHtml((node.content ?? []).map((n: JSONContent) => n.text ?? '').join(''))
      return `<pre><code>${code}</code></pre>`
    }

    case 'blockquote': {
      const inner = (node.content ?? []).map(nodeToHtml).join('\n')
      return `<blockquote>${inner}</blockquote>`
    }

    case 'horizontalRule':
      return '<hr>'

    default:
      return (node.content ?? []).map(nodeToHtml).join('\n')
  }
}

/** A4, 12 mm kenar boşluğu → yazdırılabilir genişlik (px, 96 dpi) */
const PRINT_WIDTH = 703

function imageToHtml(img: ExportImage, z: number): string {
  const transform = img.rotation ? `transform:rotate(${img.rotation}deg);` : ''
  return `<img class="nf-float" src="${escapeHtml(img.url)}" alt="${escapeHtml(img.name)}" style="left:${img.x}px;top:${img.y}px;width:${img.width}px;height:${img.height}px;opacity:${img.opacity};z-index:${z};${transform}">`
}

function buildPrintHtml(json: JSONContent, title: string, extras: ExportExtras): string {
  const bodyHtml = nodeToHtml(json)
  const safeTitle = escapeHtml(title)
  const images = extras.images ?? []
  const layout: ExportLayout = extras.layout ?? {
    textWidth: 712, padL: 24, padR: 24, padTop: 0, headerHeight: 96,
    typography: { fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 16, lineHeight: 1.6 },
    fontLinks: [],
  }
  const typo = layout.typography
  const fontLinksHtml = layout.fontLinks
    .map(href => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
    .join('\n  ')
  const pageW = layout.padL + layout.textWidth + layout.padR
  const zoom = Math.min(1, PRINT_WIDTH / pageW)
  const imagesHtml = images.map((img, i) => imageToHtml(img, i + 1)).join('\n')
  // Metnin altına taşan görseller sayfadan kesilmesin
  const contentMinHeight = Math.ceil(images.reduce((m, i) => Math.max(m, i.y + i.height), 0))

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  ${fontLinksHtml}
  <style>
    @page { size: A4; margin: 12mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: ${pageW}px;
      padding: 0 ${layout.padR}px 0 ${layout.padL}px;
      margin: 24px auto;
      zoom: ${zoom};
    }

    /* Yükseklik, editörde notun üstünden metin sütununa kadar ölçülen mesafe */
    .header {
      position: relative;
      height: ${layout.headerHeight}px;
      padding-top: ${layout.padTop}px;
      overflow: hidden;
    }
    .header::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: ${Math.min(24, layout.headerHeight)}px;
      border-top: 1px solid #e5e5e5;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: #111;
    }

    /* Editördeki .tiptap-editor ile aynı ölçüler */
    .content {
      position: relative;
      font-family: ${typo.fontFamily};
      font-size: ${typo.fontSize}px;
      line-height: ${typo.lineHeight};
      color: #333;
      word-wrap: break-word;
    }
    .content p, .content h1, .content h2, .content h3 { white-space: pre-wrap; }
    /* Editörde ilk bloğun üst boşluğu metin kökünün dışına taşar ve ölçüme dahildir */
    .content > :first-child { margin-top: 0; }

    .content h1 { font-size: 28px; font-weight: 700; margin: 28px 0 10px; line-height: 1.2; letter-spacing: -0.02em; color: #111; }
    .content h2 { font-size: 22px; font-weight: 600; margin: 22px 0 8px; letter-spacing: -0.01em; color: #111; }
    .content h3 { font-size: 18px; font-weight: 600; margin: 18px 0 6px; color: #222; }

    .content p { margin-bottom: 6px; }
    .content p:last-child { margin-bottom: 0; }

    strong { font-weight: 600; color: #111; }
    em     { font-style: italic; color: #444; }
    s      { color: #888; }

    code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 13px;
      background: #f4f4f4;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 2px 5px;
    }

    pre {
      background: #f6f6f6;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin: 14px 0;
      white-space: pre-wrap;
    }
    pre code { background: none; border: none; padding: 0; font-size: 13px; }

    ul, ol { padding-left: 24px; margin: 8px 0; }
    li { margin: 3px 0; }
    ul li::marker { color: #4D8DFF; }
    ol li::marker { color: #4D8DFF; font-weight: 600; }

    blockquote {
      border-left: 3px solid rgba(77, 141, 255, 0.5);
      padding-left: 16px;
      margin: 12px 0;
      color: #555;
      font-style: italic;
    }

    hr { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }

    /* Serbest görseller — notta olduğu gibi metnin üstünde */
    .nf-float {
      position: absolute;
      object-fit: cover;
      border-radius: 4px;
      transform-origin: center center;
    }

    @media print {
      .page { margin: 0 auto; }
      h1, h2, h3 { page-break-after: avoid; }
      pre, blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header"><h1>${safeTitle}</h1></div>
    <div class="content" style="min-height:${contentMinHeight}px">
      ${bodyHtml}
      ${imagesHtml}
    </div>
  </div>
</body>
</html>`
}

const PRINT_READY_TIMEOUT = 15_000

/** Çerçevedeki görseller ve yazı tipleri yüklenene kadar bekler (en fazla 15 sn). */
function waitForPrintAssets(doc: Window['document']): Promise<void> {
  const images = Array.from(doc.images).map(img => img.complete
    ? Promise.resolve()
    : new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      }))
  return Promise.race([
    Promise.all([...images, doc.fonts?.ready]).then(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, PRINT_READY_TIMEOUT)),
  ])
}

/**
 * Yazdırma diyaloğunu sayfa içindeki görünmez bir çerçeveden açar.
 * Yeni pencere açmadığı için pop-up engelleyicilere takılmaz.
 */
export async function exportAsPdf(json: JSONContent, title: string, extras: ExportExtras = {}) {
  const html = buildPrintHtml(json, title, extras)

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
  document.body.appendChild(frame)

  const win = frame.contentWindow
  const doc = frame.contentDocument
  if (!win || !doc) {
    frame.remove()
    throw new Error('Yazdırma çerçevesi oluşturulamadı')
  }
  doc.open()
  doc.write(html)
  doc.close()

  await waitForPrintAssets(doc)

  // "PDF olarak kaydet" dosya adı sayfa başlığından gelir
  const prevTitle = document.title
  document.title = title || 'Not'
  const cleanup = () => {
    document.title = prevTitle
    setTimeout(() => frame.remove(), 1000)
  }
  win.addEventListener('afterprint', cleanup, { once: true })
  win.focus()
  win.print()
  // afterprint gelmeyen tarayıcılar için yedek temizlik
  setTimeout(() => { if (frame.isConnected) cleanup() }, 60_000)
}
