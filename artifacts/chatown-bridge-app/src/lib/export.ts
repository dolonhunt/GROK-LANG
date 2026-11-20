import type { Message, Lang } from './types'

function linesFromMessages(messages: Message[], viewLang: Lang): string[] {
  return messages.map((m) => {
    const time = new Date(m.ts).toLocaleString()
    const name = m.speakerName || m.speakerId
    const src = m.srcText
    const tr =
      m.translations[viewLang] ||
      m.translations.bn ||
      m.translations.zh ||
      ''
    return `[${time}] ${name} (${m.srcLang}): ${src}\n  → ${tr}`
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportTxt(messages: Message[], viewLang: Lang): void {
  const body = linesFromMessages(messages, viewLang).join('\n\n')
  downloadBlob(new Blob([body], { type: 'text/plain;charset=utf-8' }), 'chatown-transcript.txt')
}

export async function exportPdf(messages: Message[], viewLang: Lang): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.text('Chatown Bridge Transcript', 40, 40)
  doc.setFontSize(10)
  let y = 70
  const maxW = 515
  for (const line of linesFromMessages(messages, viewLang)) {
    const parts = doc.splitTextToSize(line, maxW) as string[]
    for (const p of parts) {
      if (y > 780) {
        doc.addPage()
        y = 40
      }
      doc.text(p, 40, y)
      y += 14
    }
    y += 8
  }
  doc.save('chatown-transcript.pdf')
}

export async function exportDocx(messages: Message[], viewLang: Lang): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const children = [
    new Paragraph({
      text: 'Chatown Bridge Transcript',
      heading: HeadingLevel.HEADING_1,
    }),
    ...messages.flatMap((m) => {
      const time = new Date(m.ts).toLocaleString()
      const name = m.speakerName || m.speakerId
      const tr =
        m.translations[viewLang] || m.translations.bn || m.translations.zh || ''
      return [
        new Paragraph({
          children: [
            new TextRun({ text: `[${time}] ${name} (${m.srcLang})`, bold: true }),
          ],
        }),
        new Paragraph({ children: [new TextRun(m.srcText)] }),
        new Paragraph({
          children: [new TextRun({ text: `→ ${tr}`, italics: true })],
        }),
        new Paragraph({ text: '' }),
      ]
    }),
  ]
  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, 'chatown-transcript.docx')
}
