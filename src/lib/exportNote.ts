/**
 * NoteForge — Client-Side Export Engine
 *
 * All export formats are generated entirely in the browser — no backend needed.
 *
 * • Markdown (.md) — custom TipTap-JSON → Markdown traversal
 * • Plain Text (.txt) — strip formatting from markdown output
 * • DOCX (.docx) — `docx` npm package (pure JS, browser-compatible)
 * • PDF (.pdf) — styled HTML popup + window.print() (browser renders to PDF)
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  type ParagraphChild,
} from 'docx'
import type { JSONContent } from '@tiptap/core'

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

export function noteToMarkdown(json: JSONContent, title: string): string {
  const body = nodeToMd(json)
  return `# ${title}\n\n${body}\n`
}

export async function exportAsMarkdown(json: JSONContent, title: string) {
  const md   = noteToMarkdown(json, title)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  triggerDownload(blob, `${safeFilename(title)}.md`)
}

/* ═══════════════════════════════════════════════════════════════
   2. PLAIN TEXT  (.txt)
   Strip markdown syntax from the markdown output.
   ═══════════════════════════════════════════════════════════════ */

export async function exportAsText(json: JSONContent, title: string) {
  const md  = noteToMarkdown(json, title)
  // Remove markdown syntax
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
    .replace(/\n{3,}/g, '\n\n')         // collapse extra blank lines
    .trim()

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, `${safeFilename(title)}.txt`)
}

/* ═══════════════════════════════════════════════════════════════
   3. DOCX  (.docx)
   Uses the `docx` npm package (pure JS, works in browsers).
   ═══════════════════════════════════════════════════════════════ */

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
      return [new Paragraph({ heading: (headingMap[level] ?? HeadingLevel.HEADING_1) as any, children: runs })]
    }

    case 'paragraph': {
      const runs = (node.content ?? []).flatMap(inlineToDocxRuns)
      return [new Paragraph({ children: runs })]
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

export async function exportAsDocx(json: JSONContent, title: string) {
  const children = nodeToDocxBlocks(json)

  const doc = new Document({
    creator:     'NoteForge',
    title:       title,
    description: 'Exported from NoteForge',
    sections: [{
      properties: {},
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${safeFilename(title)}.docx`)
}

/* ═══════════════════════════════════════════════════════════════
   4. PDF  (.pdf)
   Converts TipTap JSON → styled HTML, opens a print window.
   Browser renders the print dialog → user saves as PDF.
   This approach preserves all formatting with zero dependencies.
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
      return `<h${level}>${text}</h${level}>`
    }

    case 'paragraph': {
      const text = (node.content ?? []).map(inlineToHtml).join('')
      return `<p>${text || '&nbsp;'}</p>`
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

export function exportAsPdf(json: JSONContent, title: string) {
  const bodyHtml = nodeToHtml(json)
  const safeTitle = escapeHtml(title)

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.75;
      color: #1a1a1a;
      padding: 48px 56px;
      max-width: 740px;
      margin: 0 auto;
    }

    h1.doc-title {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e5e5;
      color: #111;
    }

    h1 { font-size: 22px; font-weight: 700; margin: 24px 0 10px; color: #111; }
    h2 { font-size: 18px; font-weight: 600; margin: 20px 0 8px;  color: #111; }
    h3 { font-size: 15px; font-weight: 600; margin: 16px 0 6px;  color: #222; }

    p  { margin-bottom: 8px; color: #333; }

    strong { font-weight: 600; color: #111; }
    em     { font-style: italic; color: #444; }
    s      { color: #888; }

    code {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12px;
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
      overflow-x: auto;
      page-break-inside: avoid;
    }
    pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 12px;
    }

    ul, ol {
      padding-left: 24px;
      margin: 8px 0;
    }
    li { margin: 4px 0; }
    ul li::marker { color: #4D8DFF; }
    ol li::marker { color: #4D8DFF; font-weight: 600; }

    blockquote {
      border-left: 3px solid #4D8DFF;
      padding-left: 16px;
      margin: 12px 0;
      color: #555;
      font-style: italic;
    }

    hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 20px 0;
    }

    @media print {
      body { padding: 0; }
      h1, h2, h3 { page-break-after: avoid; }
      pre, blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1 class="doc-title">${safeTitle}</h1>
  ${bodyHtml}
  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 200)
    }
  <\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Lütfen pop-up engelleyiciyi devre dışı bırakın ve tekrar deneyin.')
    return
  }
  win.document.write(html)
  win.document.close()
}
