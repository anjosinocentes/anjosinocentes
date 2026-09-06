// Utilitários de CSV para exportação segura.
//
// Proteção contra CSV/Formula Injection: quando um valor começa com =, +, -, @ (ou tab/CR),
// planilhas como Excel/Sheets podem interpretá-lo como fórmula ao abrir o arquivo - um dado de
// cadastro malicioso (ex.: nome "=HYPERLINK(...)" ou "@SUM(...)") viraria código executável na
// máquina de quem abre o export. Prefixamos esses valores com um apóstrofo, que força a célula a
// ser tratada como texto, sem alterar o que o usuário vê.
//
// Também escapa aspas e sempre envolve o campo em aspas (padrão RFC 4180), preservando ";",
// quebras de linha e aspas dentro do valor.
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s
  }
  return '"' + s.replace(/"/g, '""') + '"'
}

// Monta o conteúdo CSV completo (com BOM para o Excel reconhecer UTF-8). Separador ";" por
// compatibilidade com Excel em pt-BR. Cada célula passa por csvCell.
export function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvCell).join(";"), ...rows.map((r) => r.map(csvCell).join(";"))]
  return "﻿" + lines.join("\r\n")
}
