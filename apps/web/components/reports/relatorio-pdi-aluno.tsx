"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Target, FileDown, Printer } from "lucide-react"
import { SearchableSelect } from "./searchable-select"
import { Spinner } from "@/components/ui/spinner"
import { openReportWindow, escapeHtml, downloadReportPdf, type ReportBlock } from "@/lib/report-print"
import { getStudentPdi, type StudentPdiDetail } from "@/lib/api"
import { getPdiArea, getPdiStatus } from "@/lib/pdi-constants"
import type { Aluno, Turma } from "@/lib/types"

// "Relatório de PDI do Aluno": consolida num único documento imprimível/PDF o Plano de
// Desenvolvimento Individual de uma criança - situação inicial, áreas acompanhadas e a linha
// do tempo de evoluções. Reusa o cabeçalho/rodapé padrão de lib/report-print, igual aos demais.
export function RelatorioPdiAluno({
  open,
  onOpenChange,
  students,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Aluno[]
  classes: Turma[]
}) {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StudentPdiDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const student = students.find((s) => s.id === studentId) || null

  const reset = () => {
    setStudentId(null)
    setDetail(null)
    setError("")
  }

  const handleSelect = async (id: string | null) => {
    setStudentId(id)
    setDetail(null)
    setError("")
    if (!id) return
    setLoading(true)
    try {
      const data = await getStudentPdi(id)
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o PDI desta criança.")
    } finally {
      setLoading(false)
    }
  }

  const temPdi = Boolean(detail?.pdi)
  const tracking = detail?.tracking ?? []
  const evolutions = detail?.evolutions ?? []

  const subtitle = student
    ? `Relatório de PDI - ${student.nome} - Gerado em ${new Date().toLocaleDateString("pt-BR")}`
    : "Relatório de PDI"

  // Monta os blocos comuns ao PDF e (convertidos) ao HTML de impressão.
  const buildBlocks = (): ReportBlock[] => {
    const blocks: ReportBlock[] = []
    const pdi = detail?.pdi

    blocks.push({ type: "heading", text: "Situação inicial" })
    if (pdi) {
      blocks.push({ type: "keyValue", rows: [
        ["Situação inicial", pdi.situacaoInicial?.trim() || "-"],
        ["Objetivos iniciais", pdi.objetivosIniciais?.trim() || "-"],
        ["Observações iniciais", pdi.observacoesIniciais?.trim() || "-"],
        ["Criado em", formatDate(pdi.createdAt)],
        ["Última atualização", formatDate(pdi.updatedAt)],
      ] })
    } else {
      blocks.push({ type: "text", text: "Esta criança ainda não possui um PDI cadastrado." })
    }

    blocks.push({ type: "heading", text: "Áreas acompanhadas" })
    if (tracking.length > 0) {
      blocks.push({
        type: "table",
        head: ["Área", "Objetivo", "Status", "Início", "Prazo", "Responsável"],
        rows: tracking.map((t) => [
          getPdiArea(t.area).label,
          t.objetivo?.trim() || "-",
          getPdiStatus(t.status).label,
          formatDate(t.dataInicio),
          t.prazo ? formatDate(t.prazo) : "-",
          t.responsavelNome?.trim() || "-",
        ]),
      })
    } else {
      blocks.push({ type: "text", text: "Nenhuma área em acompanhamento." })
    }

    blocks.push({ type: "heading", text: "Linha do tempo de evoluções" })
    if (evolutions.length > 0) {
      const ordenadas = [...evolutions].sort((a, b) => (a.data < b.data ? 1 : -1))
      blocks.push({
        type: "table",
        head: ["Data", "Área", "Status", "Relato", "Próximos passos"],
        rows: ordenadas.map((e) => [
          formatDate(e.data),
          getPdiArea(e.area).label,
          getPdiStatus(e.status).label,
          e.relato?.trim() || "-",
          e.proximosPassos?.trim() || "-",
        ]),
      })
    } else {
      blocks.push({ type: "text", text: "Nenhuma evolução registrada." })
    }

    return blocks
  }

  const handleDownloadPdf = async () => {
    if (!student) return
    await downloadReportPdf({
      filename: `PDI - ${student.nome}`,
      subtitle,
      blocks: buildBlocks(),
    })
  }

  const handlePrint = () => {
    if (!student) return
    const bodyHtml = buildBlocks()
      .map((block) => {
        if (block.type === "heading") return `<h3>${escapeHtml(block.text)}</h3>`
        if (block.type === "text") return `<p>${escapeHtml(block.text)}</p>`
        if (block.type === "keyValue") {
          const linhas = block.rows
            .map(
              ([k, v]) => `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;width:35%;font-weight:bold;">${escapeHtml(k)}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(v)}</td>
              </tr>`
            )
            .join("")
          return `<table><tbody>${linhas}</tbody></table>`
        }
        // table
        const thead = `<tr>${block.head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`
        const tbody = block.rows
          .map(
            (r) => `<tr>${r.map((c) => `<td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(c)}</td>`).join("")}</tr>`
          )
          .join("")
        return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
      })
      .join("")

    openReportWindow({
      title: `PDI - ${student.nome}`,
      subtitle,
      bodyHtml,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Relatório de PDI do Aluno
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione uma criança para visualizar e exportar o Plano de Desenvolvimento Individual dela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-foreground font-medium">Criança *</Label>
            <SearchableSelect
              options={students.map((s) => ({ id: s.id, label: s.nome }))}
              value={studentId}
              onChange={handleSelect}
              placeholder="Selecione a criança..."
              emptyMessage="Nenhuma criança encontrada."
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && student && detail && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              {!temPdi ? (
                <p className="text-sm text-muted-foreground">
                  Esta criança ainda não possui um PDI cadastrado.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Situação inicial</h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {detail.pdi?.situacaoInicial?.trim() || "-"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Áreas acompanhadas ({tracking.length})</h4>
                    {tracking.length > 0 ? (
                      <ul className="space-y-1">
                        {tracking.map((t) => (
                          <li key={t.id} className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{getPdiArea(t.area).label}</span>
                            {" - "}{getPdiStatus(t.status).label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma área em acompanhamento.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Evoluções registradas: {evolutions.length}</h4>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadPdf} className="flex-1">
                  <FileDown className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
                <Button variant="outline" onClick={handlePrint} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Formata uma data (aceita "yyyy-mm-dd", ISO completo ou já em "dd/mm/aaaa") para "dd/mm/aaaa".
function formatDate(value: string): string {
  if (!value) return "-"
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const d = new Date(isoDateOnly ? value + "T12:00:00" : value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString("pt-BR")
}
