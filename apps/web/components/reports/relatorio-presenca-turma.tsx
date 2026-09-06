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
import { Users, FileDown, Printer } from "lucide-react"
import { SearchableSelect } from "./searchable-select"
import { getAttendanceRecords } from "@/lib/api"
import { openReportWindow, escapeHtml } from "@/lib/report-print"
import type { Aluno, Turma } from "@/lib/types"
import { toast } from "sonner"

type StudentSummary = { studentId: string; nome: string; presencas: number; faltas: number; total: number; percentual: number }
type DaySummary = { date: string; presentes: number; faltas: number }

// "Presença por Turma" (item 2 do pedido): frequência de todos os alunos matriculados numa
// turma, num período. Usa os mesmos registros reais de app/api/attendance/route.ts.
export function RelatorioPresencaTurma({
  open,
  onOpenChange,
  students,
  classes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Aluno[]
  classes: Turma[]
}) {
  const [classId, setClassId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [alunosResumo, setAlunosResumo] = useState<StudentSummary[] | null>(null)
  const [porDia, setPorDia] = useState<DaySummary[] | null>(null)

  const turma = classes.find((c) => c.id === classId) || null

  const resumoTurma = useMemo(() => {
    if (!alunosResumo) return null
    const totalPresencas = alunosResumo.reduce((acc, a) => acc + a.presencas, 0)
    const totalFaltas = alunosResumo.reduce((acc, a) => acc + a.faltas, 0)
    const totalRegistros = totalPresencas + totalFaltas
    const mediaPresenca = totalRegistros > 0 ? Math.round((totalPresencas / totalRegistros) * 100) : 0
    return { quantidadeAlunos: alunosResumo.length, totalPresencas, totalFaltas, mediaPresenca }
  }, [alunosResumo])

  const reset = () => {
    setClassId(null)
    setStartDate("")
    setEndDate("")
    setAlunosResumo(null)
    setPorDia(null)
  }

  const handleGerar = async () => {
    if (!classId || !startDate || !endDate) return
    setLoading(true)
    setAlunosResumo(null)
    setPorDia(null)
    try {
      const records = await getAttendanceRecords({ classId, startDate, endDate })
      const alunosDaTurma = students.filter((s) => s.classIds?.includes(classId) || s.classId === classId)

      const porAluno = new Map<string, { presencas: number; faltas: number }>()
      const porData = new Map<string, { presentes: number; faltas: number }>()
      for (const r of records) {
        const atual = porAluno.get(r.studentId) || { presencas: 0, faltas: 0 }
        if (r.status === "PRESENT") atual.presencas++
        else atual.faltas++
        porAluno.set(r.studentId, atual)

        const dia = porData.get(r.date) || { presentes: 0, faltas: 0 }
        if (r.status === "PRESENT") dia.presentes++
        else dia.faltas++
        porData.set(r.date, dia)
      }

      const resumo: StudentSummary[] = alunosDaTurma
        .map((s) => {
          const stats = porAluno.get(s.id) || { presencas: 0, faltas: 0 }
          const total = stats.presencas + stats.faltas
          return {
            studentId: s.id,
            nome: s.nome,
            presencas: stats.presencas,
            faltas: stats.faltas,
            total,
            percentual: total > 0 ? Math.round((stats.presencas / total) * 100) : 0,
          }
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))

      const dias: DaySummary[] = Array.from(porData.entries())
        .map(([date, v]) => ({ date, presentes: v.presentes, faltas: v.faltas }))
        .sort((a, b) => (a.date < b.date ? -1 : 1))

      setAlunosResumo(resumo)
      setPorDia(dias)
    } catch (error) {
      console.error("Erro ao gerar relatório de presença por turma:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.")
    } finally {
      setLoading(false)
    }
  }

  const buildBodyHtml = () => {
    if (!turma || !alunosResumo || !resumoTurma) return ""
    const tableRows = alunosResumo
      .map(
        (a) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(a.nome)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${a.presencas}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${a.faltas}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${a.total}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${a.percentual}%</td>
        </tr>`
      )
      .join("")

    const diasRows = (porDia || [])
      .map(
        (d) => `<tr>
          <td style="padding:6px;border-bottom:1px solid #eee;">${new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">${d.presentes}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">${d.faltas}</td>
        </tr>`
      )
      .join("")

    return `
      <p><b>Turma:</b> ${escapeHtml(turma.nome)}</p>
      <p><b>Período:</b> ${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR")}</p>

      <h3>Frequência por aluno</h3>
      <table>
        <thead><tr><th>Aluno</th><th style="text-align:center;">Presenças</th><th style="text-align:center;">Faltas</th><th style="text-align:center;">Total</th><th style="text-align:right;">% Presença</th></tr></thead>
        <tbody>${tableRows || '<tr><td colspan="5" style="padding:8px;">Nenhum aluno matriculado nesta turma.</td></tr>'}</tbody>
      </table>

      <h3>Resumo da turma</h3>
      <p><b>Quantidade de alunos:</b> ${resumoTurma.quantidadeAlunos}</p>
      <p><b>Total de presenças:</b> ${resumoTurma.totalPresencas}</p>
      <p><b>Total de faltas:</b> ${resumoTurma.totalFaltas}</p>
      <p><b>Média de presença da turma:</b> ${resumoTurma.mediaPresenca}%</p>

      <h3>Detalhamento por data</h3>
      <table>
        <thead><tr><th>Data</th><th style="text-align:center;">Presentes</th><th style="text-align:center;">Faltas</th></tr></thead>
        <tbody>${diasRows || '<tr><td colspan="3" style="padding:6px;">Nenhum registro no período.</td></tr>'}</tbody>
      </table>
    `
  }

  const handleExport = () => {
    if (!turma) return
    openReportWindow({
      title: `Presença - ${turma.nome}`,
      subtitle: `Relatório de Presença por Turma - Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      bodyHtml: buildBodyHtml(),
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
            <Users className="h-5 w-5 text-primary" />
            Presença por Turma
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Consulte a frequência dos alunos de uma turma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-foreground font-medium">Turma *</Label>
              <SearchableSelect
                options={classes.map((c) => ({ id: c.id, label: c.nome, hint: c.curso }))}
                value={classId}
                onChange={(id) => {
                  setClassId(id)
                  setAlunosResumo(null)
                  setPorDia(null)
                }}
                placeholder="Selecione a turma..."
                emptyMessage="Nenhuma turma encontrada."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-turma-inicio" className="text-foreground font-medium">Data inicial *</Label>
              <Input id="rel-turma-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-turma-fim" className="text-foreground font-medium">Data final *</Label>
              <Input id="rel-turma-fim" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <Button
            onClick={handleGerar}
            disabled={!classId || !startDate || !endDate || loading}
            className="bg-primary hover:bg-primary/90 font-semibold w-full sm:w-auto"
          >
            {loading ? "Gerando..." : "Gerar Relatório"}
          </Button>

          {alunosResumo && resumoTurma && turma && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="text-sm space-y-0.5">
                <p><span className="text-muted-foreground">Turma:</span> <span className="font-medium text-foreground">{turma.nome}</span></p>
                <p>
                  <span className="text-muted-foreground">Período:</span>{" "}
                  <span className="font-medium text-foreground">
                    {new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR")} a {new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </p>
              </div>

              <div className="rounded-md border border-border overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Aluno</TableHead>
                      <TableHead className="text-center">Presenças</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-right">% Presença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alunosResumo.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhum aluno matriculado nesta turma.
                        </TableCell>
                      </TableRow>
                    ) : (
                      alunosResumo.map((a) => (
                        <TableRow key={a.studentId}>
                          <TableCell className="font-medium text-foreground">{a.nome}</TableCell>
                          <TableCell className="text-center text-success font-medium">{a.presencas}</TableCell>
                          <TableCell className="text-center text-destructive font-medium">{a.faltas}</TableCell>
                          <TableCell className="text-center">{a.total}</TableCell>
                          <TableCell className="text-right font-medium">{a.percentual}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Alunos</p>
                  <p className="text-lg font-bold text-foreground">{resumoTurma.quantidadeAlunos}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Presenças</p>
                  <p className="text-lg font-bold text-success">{resumoTurma.totalPresencas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Faltas</p>
                  <p className="text-lg font-bold text-destructive">{resumoTurma.totalFaltas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Média de presença</p>
                  <p className="text-lg font-bold text-foreground">{resumoTurma.mediaPresenca}%</p>
                </CardContent></Card>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport} className="flex-1">
                  <FileDown className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
                <Button variant="outline" onClick={handleExport} className="flex-1">
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
