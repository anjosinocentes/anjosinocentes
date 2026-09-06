// Padrão visual/estrutural único para todo relatório impresso/PDF do sistema (logo, nome da
// instituição, tipografia, rodapé) - extraído do PDF do PDI (app/dashboard/pdis/[studentId]/page.tsx)
// para os relatórios de presença reutilizarem exatamente a mesma base, em vez de duplicá-la.
// Qualquer novo relatório deve passar por aqui, não reimplementar seu próprio cabeçalho/rodapé.

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// A janela do relatório é escrita via document.write numa página same-origin - texto livre
// precisa ser escapado antes de entrar no HTML, senão um valor malicioso vira um script
// executando com acesso a window.opener (a própria aplicação).
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const BASE_STYLES = `
  body { font-family: sans-serif; padding: 40px; color: #333; }
  h1 { color: #f97316; margin-bottom: 5px; }
  h2 { color: #555; font-size: 16px; margin-top: 0; margin-bottom: 20px; font-weight: normal; }
  h3 { margin-top: 32px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #f3f4f6; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
  .report-header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #f97316; padding-bottom: 16px; margin-bottom: 20px; }
  .report-header img { height: 40px; width: auto; }
  .report-header h1, .report-header h2 { margin: 0; }
  .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
`

// Abre a janela de impressão com o mesmo cabeçalho (logo + "Projeto Anjos Inocentes"), rodapé e
// estilo base do PDF do PDI. `bodyHtml` já deve vir com o HTML escapado pelo chamador.
export function openReportWindow({
  title,
  subtitle,
  bodyHtml,
  extraStyles,
}: {
  title: string
  subtitle: string
  bodyHtml: string
  extraStyles?: string
}) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return null

  // URL absoluta (não relativa): a janela é aberta em branco e só recebe HTML via document.write,
  // então uma URL relativa não tem uma base confiável para resolver contra a origem do app.
  const logoUrl = `${window.location.origin}/logo.png`

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          ${BASE_STYLES}
          ${extraStyles || ""}
        </style>
      </head>
      <body>
        <div class="report-header">
          <img src="${escapeHtml(logoUrl)}" alt="Anjos Inocentes" />
          <div>
            <h1>Projeto Anjos Inocentes</h1>
            <h2>${escapeHtml(subtitle)}</h2>
          </div>
        </div>

        ${bodyHtml}

        <div class="footer">Sistema de Gestão Acadêmica - Anjos Inocentes</div>
        <script>
          window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
  return printWindow
}

// Carrega uma imagem same-origin como data URL (necessário para o jsPDF.addImage). Devolve null
// em qualquer falha, para o PDF ser gerado mesmo sem o logo.
async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = rawDataUrl
    })
    // Reduz o logo antes de embutir no PDF: a imagem original pode ter milhares de pixels e
    // inflaria o arquivo em vários MB. No PDF ele aparece com ~12mm de altura, então ~160px basta.
    const maxH = 160
    if (img.height > maxH) {
      const scale = maxH / img.height
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h)
        return { dataUrl: canvas.toDataURL("image/png"), width: w, height: h }
      }
    }
    return { dataUrl: rawDataUrl, width: img.width, height: img.height }
  } catch {
    return null
  }
}

// Blocos de conteúdo suportados por downloadReportPdf. Cobrem o que os relatórios usam hoje:
// título de seção, tabela chave/valor (ficha cadastral) e tabela com cabeçalho (presença).
export type ReportBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "keyValue"; rows: Array<[string, string]> }
  | { type: "table"; head: string[]; rows: string[][] }

// Gera e BAIXA um PDF de verdade no cliente (texto selecionável), sem depender da "impressora
// PDF" do sistema. Reproduz o mesmo cabeçalho (logo + Projeto Anjos Inocentes), subtítulo e
// rodapé do openReportWindow, para os dois caminhos (baixar vs imprimir) ficarem visualmente iguais.
export async function downloadReportPdf({
  filename,
  subtitle,
  blocks,
}: {
  filename: string
  subtitle: string
  blocks: ReportBlock[]
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2

  // Cabeçalho: logo + nome da instituição + subtítulo, com linha laranja embaixo.
  const logo = await loadImageDataUrl(`${window.location.origin}/logo.png`)
  let headerBottom = 16
  const logoH = 12
  if (logo) {
    const logoW = (logo.width / logo.height) * logoH
    try {
      doc.addImage(logo.dataUrl, "PNG", marginX, 12, logoW, logoH, undefined, "FAST")
    } catch {
      /* segue sem logo se o formato não for suportado */
    }
  }
  const textX = logo ? marginX + 26 : marginX
  doc.setTextColor(249, 115, 22)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("Projeto Anjos Inocentes", textX, 18)
  doc.setTextColor(85, 85, 85)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(subtitle, textX, 24)
  headerBottom = 30
  doc.setDrawColor(249, 115, 22)
  doc.setLineWidth(0.6)
  doc.line(marginX, headerBottom, pageWidth - marginX, headerBottom)

  let cursorY = headerBottom + 8

  for (const block of blocks) {
    if (block.type === "heading") {
      doc.setTextColor(51, 51, 51)
      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      doc.text(block.text, marginX, cursorY)
      cursorY += 4
    } else if (block.type === "text") {
      doc.setTextColor(51, 51, 51)
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      const lines = doc.splitTextToSize(block.text, contentWidth)
      doc.text(lines, marginX, cursorY + 4)
      cursorY += 4 + lines.length * 5
    } else if (block.type === "keyValue") {
      autoTable(doc, {
        startY: cursorY + 2,
        margin: { left: marginX, right: marginX },
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2.5, textColor: [51, 51, 51], lineColor: [221, 221, 221] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: contentWidth * 0.35, fillColor: [243, 244, 246] },
          1: { cellWidth: contentWidth * 0.65 },
        },
        body: block.rows.map(([k, v]) => [k, v]),
      })
      cursorY = (doc as any).lastAutoTable.finalY + 6
    } else if (block.type === "table") {
      autoTable(doc, {
        startY: cursorY + 2,
        margin: { left: marginX, right: marginX },
        theme: "grid",
        headStyles: { fillColor: [243, 244, 246], textColor: [51, 51, 51], fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 2.5, textColor: [51, 51, 51], lineColor: [221, 221, 221] },
        head: [block.head],
        body: block.rows,
      })
      cursorY = (doc as any).lastAutoTable.finalY + 6
    }
  }

  // Rodapé em todas as páginas.
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(238, 238, 238)
    doc.setLineWidth(0.3)
    doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16)
    doc.setTextColor(136, 136, 136)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text("Sistema de Gestão Acadêmica - Anjos Inocentes", pageWidth / 2, pageHeight - 10, { align: "center" })
  }

  const safeName = filename.replace(/[\\/:*?"<>|]+/g, "_")
  doc.save(safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`)
}
