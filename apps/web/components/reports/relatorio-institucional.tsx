"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { BarChart3, FileDown, Printer } from "lucide-react"
import { getReportsStats } from "@/lib/api"
import { openReportWindow, escapeHtml, downloadReportPdf } from "@/lib/report-print"
import { toast } from "sonner"

const MESES_POR_PERIODO: Record<string, number> = { trimestre: 3, semestre: 6, ano: 12 }
const PERIODO_LABEL: Record<string, string> = { trimestre: "Último trimestre", semestre: "Último semestre", ano: "Último ano" }

// "Relatório Institucional Consolidado": visão geral do projeto num período (crianças, matrículas,
// frequência média, oficinas), pensado para prestação de contas a doadores/parceiros. Reaproveita
// exatamente os agregados de /stats/reports usados nos gráficos da página de Relatórios.
export function RelatorioInstitucional({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [periodo, setPeriodo] = useState("semestre")
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || data) return
    setLoading(true)
    getReportsStats()
      .then(setData)
      .catch((err) => {
        console.error("Erro ao carregar dados institucionais:", err)
        toast.error("Não foi possível carregar os dados do relatório.")
      })
      .finally(() => setLoading(false))
  }, [open, data])

  const resumo = useMemo(() => {
    if (!data) return null
    const n = MESES_POR_PERIODO[periodo]
    const presenca = (data.presencaMensal ?? []).slice(-n)
    const matriculas = (data.matriculasMensais ?? []).slice(-n)
    const comRegistro = presenca.filter((m: any) => !m.semRegistro)
    const mediaPresenca =
      comRegistro.length > 0
        ? Math.round(comRegistro.reduce((acc: number, m: any) => acc + m.presentes, 0) / comRegistro.length)
        : 0
    const totalMatriculas = matriculas.reduce((acc: number, m: any) => acc + m.matriculas, 0)
    return {
      totalStudents: data.totalStudents ?? 0,
      activeClasses: data.activeClasses ?? 0,
      totalMatriculas,
      mediaPresenca,
      distribuicao: (data.courseDistribution ?? []) as Array<{ nome: string; alunos: number }>,
      matriculas: matriculas as Array<{ mes: string; matriculas: number }>,
      presenca: presenca as Array<{ mes: string; presentes: number; semRegistro?: boolean }>,
    }
  }, [data, periodo])

  const subtitle = `Relatório Institucional (${PERIODO_LABEL[periodo]}) - Gerado em ${new Date().toLocaleDateString("pt-BR")}`

  const handleDownloadPdf = async () => {
    if (!resumo) return
    await downloadReportPdf({
      filename: `Relatorio Institucional - ${PERIODO_LABEL[periodo]}`,
      subtitle,
      blocks: [
        { type: "heading", text: "Indicadores gerais" },
        {
          type: "keyValue",
          rows: [
            ["Total de crianças", String(resumo.totalStudents)],
            ["Turmas ativas", String(resumo.activeClasses)],
            [`Novas matrículas (${PERIODO_LABEL[periodo].toLowerCase()})`, String(resumo.totalMatriculas)],
            ["Frequência média no período", `${resumo.mediaPresenca}%`],
          ],
        },
        { type: "heading", text: "Distribuição por oficina" },
        {
          type: "table",
          head: ["Oficina", "Crianças"],
          rows: resumo.distribuicao.length
            ? resumo.distribuicao.map((c) => [c.nome, String(c.alunos)])
            : [["Sem dados", "-"]],
        },
        { type: "heading", text: "Matrículas por mês" },
        {
          type: "table",
          head: ["Mês", "Matrículas"],
          rows: resumo.matriculas.map((m) => [m.mes, String(m.matriculas)]),
        },
        { type: "heading", text: "Frequência por mês" },
        {
          type: "table",
          head: ["Mês", "% Presença"],
          rows: resumo.presenca.map((m) => [m.mes, m.semRegistro ? "Sem registro" : `${m.presentes}%`]),
        },
      ],
    })
  }

  const handlePrint = () => {
    if (!resumo) return
    const dist = resumo.distribuicao.length
      ? resumo.distribuicao.map((c) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(c.nome)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${c.alunos}</td></tr>`).join("")
      : '<tr><td colspan="2" style="padding:8px;">Sem dados.</td></tr>'
    const matr = resumo.matriculas.map((m) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(m.mes)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${m.matriculas}</td></tr>`).join("")
    const freq = resumo.presenca.map((m) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(m.mes)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${m.semRegistro ? "Sem registro" : m.presentes + "%"}</td></tr>`).join("")
    openReportWindow({
      title: "Relatório Institucional",
      subtitle,
      bodyHtml: `
        <h3>Indicadores gerais</h3>
        <p><b>Total de crianças:</b> ${resumo.totalStudents}</p>
        <p><b>Turmas ativas:</b> ${resumo.activeClasses}</p>
        <p><b>Novas matrículas (${escapeHtml(PERIODO_LABEL[periodo].toLowerCase())}):</b> ${resumo.totalMatriculas}</p>
        <p><b>Frequência média no período:</b> ${resumo.mediaPresenca}%</p>
        <h3>Distribuição por oficina</h3>
        <table><thead><tr><th>Oficina</th><th style="text-align:right;">Crianças</th></tr></thead><tbody>${dist}</tbody></table>
        <h3>Matrículas por mês</h3>
        <table><thead><tr><th>Mês</th><th style="text-align:right;">Matrículas</th></tr></thead><tbody>${matr}</tbody></table>
        <h3>Frequência por mês</h3>
        <table><thead><tr><th>Mês</th><th style="text-align:right;">% Presença</th></tr></thead><tbody>${freq}</tbody></table>
      `,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório Institucional Consolidado
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Visão geral do projeto no período (crianças, matrículas, frequência e oficinas), para prestação de contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground font-medium">Período</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="semestre">Semestre</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {!loading && resumo && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Crianças</p>
                  <p className="text-lg font-bold text-foreground">{resumo.totalStudents}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Turmas ativas</p>
                  <p className="text-lg font-bold text-foreground">{resumo.activeClasses}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Matrículas</p>
                  <p className="text-lg font-bold text-foreground">{resumo.totalMatriculas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Freq. média</p>
                  <p className="text-lg font-bold text-foreground">{resumo.mediaPresenca}%</p>
                </CardContent></Card>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-1">Distribuição por oficina</p>
                <div className="rounded-md border border-border overflow-x-auto max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Oficina</TableHead>
                        <TableHead className="text-right">Crianças</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumo.distribuicao.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground py-4">Sem dados.</TableCell>
                        </TableRow>
                      ) : (
                        resumo.distribuicao.map((c) => (
                          <TableRow key={c.nome}>
                            <TableCell className="font-medium text-foreground">{c.nome}</TableCell>
                            <TableCell className="text-right">{c.alunos}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
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
