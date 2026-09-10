"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Layers, FileDown, Printer } from "lucide-react"
import { getAttendanceRecords } from "@/lib/api"
import { openReportWindow, escapeHtml, shareOrSaveReportPdf } from "@/lib/report-print"
import type { Turma } from "@/lib/types"
import { toast } from "sonner"

type TurmaRow = {
  classId: string
  nome: string
  curso: string
  presencas: number
  faltas: number
  total: number
  percentual: number | null
}

// "Frequência por Turma (consolidado)": diferente do "Presença por Turma" (que detalha UMA turma),
// este traz TODAS as turmas de uma vez, com a taxa de presença de cada uma no período - uma visão
// institucional para comparar turmas e enxergar as de baixa frequência. Usa os registros reais de
// app/api/attendance.
export function RelatorioFrequenciaTurmas({
  open,
  onOpenChange,
  classes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classes: Turma[]
}) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<TurmaRow[] | null>(null)

  const geral = useMemo(() => {
    if (!rows) return null
    const presencas = rows.reduce((acc, r) => acc + r.presencas, 0)
    const faltas = rows.reduce((acc, r) => acc + r.faltas, 0)
    const total = presencas + faltas
    return {
      turmas: rows.length,
      presencas,
      faltas,
      media: total > 0 ? Math.round((presencas / total) * 100) : 0,
    }
  }, [rows])

  const reset = () => {
    setStartDate("")
    setEndDate("")
    setRows(null)
  }

  const handleGerar = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    setRows(null)
    try {
      const records = await getAttendanceRecords({ startDate, endDate })
      const porTurma = new Map<string, { presencas: number; faltas: number }>()
      for (const r of records) {
        const key = r.classId || "__sem_turma__"
        const atual = porTurma.get(key) || { presencas: 0, faltas: 0 }
        if (r.status === "PRESENT") atual.presencas++
        else atual.faltas++
        porTurma.set(key, atual)
      }

      const resultado: TurmaRow[] = classes.map((c) => {
        const stats = porTurma.get(c.id) || { presencas: 0, faltas: 0 }
        const total = stats.presencas + stats.faltas
        return {
          classId: c.id,
          nome: c.nome,
          curso: c.curso,
          presencas: stats.presencas,
          faltas: stats.faltas,
          total,
          percentual: total > 0 ? Math.round((stats.presencas / total) * 100) : null,
        }
      })

      // Registros sem turma associada (se houver) entram como uma linha à parte, para não sumirem
      // do total geral.
      const semTurma = porTurma.get("__sem_turma__")
      if (semTurma && semTurma.presencas + semTurma.faltas > 0) {
        const total = semTurma.presencas + semTurma.faltas
        resultado.push({
          classId: "__sem_turma__",
          nome: "(Sem turma)",
          curso: "",
          presencas: semTurma.presencas,
          faltas: semTurma.faltas,
          total,
          percentual: total > 0 ? Math.round((semTurma.presencas / total) * 100) : null,
        })
      }

      resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
      setRows(resultado)
    } catch (error) {
      console.error("Erro ao gerar frequência por turma:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.")
    } finally {
      setLoading(false)
    }
  }

  const periodoLabel = () =>
    `${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR")}`

  const subtitle = `Frequência por Turma - Gerado em ${new Date().toLocaleDateString("pt-BR")}`

  const handleDownloadPdf = async () => {
    if (!rows || !geral) return
    await shareOrSaveReportPdf({
      filename: `Frequencia por Turma - ${startDate} a ${endDate}`,
      subtitle,
      blocks: [
        { type: "text", text: `Período: ${periodoLabel()}` },
        {
          type: "table",
          head: ["Turma", "Oficina", "Presenças", "Faltas", "Total", "% Presença"],
          rows: rows.map((r) => [
            r.nome,
            r.curso || "-",
            String(r.presencas),
            String(r.faltas),
            String(r.total),
            r.percentual === null ? "-" : `${r.percentual}%`,
          ]),
        },
        { type: "heading", text: "Resumo geral" },
        {
          type: "keyValue",
          rows: [
            ["Turmas", String(geral.turmas)],
            ["Total de presenças", String(geral.presencas)],
            ["Total de faltas", String(geral.faltas)],
            ["Média de presença", `${geral.media}%`],
          ],
        },
      ],
    })
  }

  const handlePrint = () => {
    if (!rows || !geral) return
    const tableRows = rows
      .map(
        (r) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(r.nome)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(r.curso || "-")}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${r.presencas}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${r.faltas}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${r.total}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${r.percentual === null ? "-" : r.percentual + "%"}</td>
        </tr>`
      )
      .join("")
    openReportWindow({
      title: "Frequência por Turma",
      subtitle,
      bodyHtml: `
        <p><b>Período:</b> ${escapeHtml(periodoLabel())}</p>
        <h3>Frequência por turma</h3>
        <table>
          <thead><tr><th>Turma</th><th>Oficina</th><th style="text-align:center;">Presenças</th><th style="text-align:center;">Faltas</th><th style="text-align:center;">Total</th><th style="text-align:right;">% Presença</th></tr></thead>
          <tbody>${tableRows || '<tr><td colspan="6" style="padding:8px;">Nenhum registro no período.</td></tr>'}</tbody>
        </table>
        <h3>Resumo geral</h3>
        <p><b>Turmas:</b> ${geral.turmas}</p>
        <p><b>Total de presenças:</b> ${geral.presencas}</p>
        <p><b>Total de faltas:</b> ${geral.faltas}</p>
        <p><b>Média de presença:</b> ${geral.media}%</p>
      `,
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
            <Layers className="h-5 w-5 text-primary" />
            Frequência por Turma
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Taxa de presença de todas as turmas no período, para comparar e identificar turmas com baixa frequência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rel-freq-inicio" className="text-foreground font-medium">Data inicial *</Label>
              <Input id="rel-freq-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-freq-fim" className="text-foreground font-medium">Data final *</Label>
              <Input id="rel-freq-fim" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <Button
            onClick={handleGerar}
            disabled={!startDate || !endDate || loading}
            className="bg-primary hover:bg-primary/90 font-semibold w-full sm:w-auto"
          >
            {loading ? "Gerando..." : "Gerar Relatório"}
          </Button>

          {rows && geral && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="text-sm">
                <p><span className="text-muted-foreground">Período:</span> <span className="font-medium text-foreground">{periodoLabel()}</span></p>
              </div>

              <div className="rounded-md border border-border overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Turma</TableHead>
                      <TableHead>Oficina</TableHead>
                      <TableHead className="text-center">Presenças</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-right">% Presença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhuma turma cadastrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.classId}>
                          <TableCell className="font-medium text-foreground">{r.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{r.curso || "-"}</TableCell>
                          <TableCell className="text-center text-success font-medium">{r.presencas}</TableCell>
                          <TableCell className="text-center text-destructive font-medium">{r.faltas}</TableCell>
                          <TableCell className="text-right font-medium">
                            {r.percentual === null ? <span className="text-muted-foreground">-</span> : `${r.percentual}%`}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Turmas</p>
                  <p className="text-lg font-bold text-foreground">{geral.turmas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Presenças</p>
                  <p className="text-lg font-bold text-success">{geral.presencas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Faltas</p>
                  <p className="text-lg font-bold text-destructive">{geral.faltas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Média geral</p>
                  <p className="text-lg font-bold text-foreground">{geral.media}%</p>
                </CardContent></Card>
              </div>

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
