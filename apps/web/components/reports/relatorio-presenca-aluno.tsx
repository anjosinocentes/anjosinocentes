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
import { Calendar, FileDown, Printer } from "lucide-react"
import { SearchableSelect } from "./searchable-select"
import { getAttendanceRecords } from "@/lib/api"
import { openReportWindow, escapeHtml } from "@/lib/report-print"
import type { Aluno, Turma } from "@/lib/types"
import { toast } from "sonner"

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatDiaSemana(dateStr: string) {
  return capitalize(new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" }))
}

type ReportRow = { date: string; classId: string | null; status: string }

// "Presença por Aluno" (item 1 do pedido): histórico de presença de uma única criança, com
// resumo de frequência. Usa exatamente os registros reais de app/api/attendance/route.ts - não
// duplica cadastro de crianças/turmas, só consulta o que já existe.
export function RelatorioPresencaAluno({
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
  const [studentId, setStudentId] = useState<string | null>(null)
  const [classId, setClassId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReportRow[] | null>(null)

  const student = students.find((s) => s.id === studentId) || null
  const studentClasses = useMemo(
    () => classes.filter((c) => student?.classIds?.includes(c.id)),
    [classes, student]
  )
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])

  // Sem filtro de turma explícito, só mostra um nome específico se a criança tiver uma única
  // turma (sem ambiguidade) - com mais de uma, a tabela já traz a turma de cada registro, então
  // o resumo deve dizer "Todas" em vez de sugerir que só a primeira turma foi considerada.
  const resultClassName = classId
    ? classById.get(classId)?.nome
    : studentClasses.length === 1
      ? studentClasses[0].nome
      : "Todas"

  const resumo = useMemo(() => {
    if (!rows) return null
    const total = rows.length
    const presencas = rows.filter((r) => r.status === "PRESENT").length
    const faltas = total - presencas
    const percentual = total > 0 ? Math.round((presencas / total) * 100) : 0
    return { total, presencas, faltas, percentual }
  }, [rows])

  const reset = () => {
    setStudentId(null)
    setClassId(null)
    setStartDate("")
    setEndDate("")
    setRows(null)
  }

  const handleGerar = async () => {
    if (!studentId || !startDate || !endDate) return
    setLoading(true)
    setRows(null)
    try {
      const records = await getAttendanceRecords({ studentId, classId: classId || undefined, startDate, endDate })
      const sorted = records
        .map((r) => ({ date: r.date, classId: r.classId, status: r.status }))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      setRows(sorted)
    } catch (error) {
      console.error("Erro ao gerar relatório de presença por aluno:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.")
    } finally {
      setLoading(false)
    }
  }

  const buildBodyHtml = () => {
    if (!student || !rows || !resumo) return ""
    const tableRows = rows
      .map((r) => {
        const turma = r.classId ? classById.get(r.classId) : undefined
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(formatDiaSemana(r.date))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(turma?.nome || "-")}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${r.status === "PRESENT" ? "Presente" : "Falta"}</td>
        </tr>`
      })
      .join("")

    return `
      <p><b>Criança:</b> ${escapeHtml(student.nome)}</p>
      <p><b>Turma:</b> ${escapeHtml(resultClassName || "Todas")}</p>
      <p><b>Período:</b> ${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR")}</p>

      <h3>Registros de presença</h3>
      <table>
        <thead><tr><th>Data</th><th>Dia</th><th>Turma</th><th>Situação</th></tr></thead>
        <tbody>${tableRows || '<tr><td colspan="4" style="padding:8px;">Nenhum registro no período.</td></tr>'}</tbody>
      </table>

      <h3>Resumo</h3>
      <p><b>Total de registros:</b> ${resumo.total}</p>
      <p><b>Total de presenças:</b> ${resumo.presencas}</p>
      <p><b>Total de faltas:</b> ${resumo.faltas}</p>
      <p><b>Percentual de presença:</b> ${resumo.percentual}%</p>
    `
  }

  const handleExport = () => {
    if (!student) return
    openReportWindow({
      title: `Presença - ${student.nome}`,
      subtitle: `Relatório de Presença por Aluno - Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
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
            <Calendar className="h-5 w-5 text-primary" />
            Presença por Aluno
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Consulte o histórico de presença de uma criança específica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-foreground font-medium">Criança *</Label>
              <SearchableSelect
                options={students.map((s) => ({ id: s.id, label: s.nome }))}
                value={studentId}
                onChange={(id) => {
                  setStudentId(id)
                  setClassId(null)
                  setRows(null)
                }}
                placeholder="Selecione a criança..."
                emptyMessage="Nenhuma criança encontrada."
              />
            </div>

            {studentClasses.length > 1 && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-foreground font-medium">Turma (opcional)</Label>
                <SearchableSelect
                  options={studentClasses.map((c) => ({ id: c.id, label: c.nome }))}
                  value={classId}
                  onChange={setClassId}
                  placeholder="Todas as turmas da criança"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rel-aluno-inicio" className="text-foreground font-medium">Data inicial *</Label>
              <Input id="rel-aluno-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-aluno-fim" className="text-foreground font-medium">Data final *</Label>
              <Input id="rel-aluno-fim" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <Button
            onClick={handleGerar}
            disabled={!studentId || !startDate || !endDate || loading}
            className="bg-primary hover:bg-primary/90 font-semibold w-full sm:w-auto"
          >
            {loading ? "Gerando..." : "Gerar Relatório"}
          </Button>

          {rows && resumo && student && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="text-sm space-y-0.5">
                <p><span className="text-muted-foreground">Criança:</span> <span className="font-medium text-foreground">{student.nome}</span></p>
                <p><span className="text-muted-foreground">Turma:</span> <span className="font-medium text-foreground">{resultClassName || "Todas"}</span></p>
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
                      <TableHead>Data</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead>Turma</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Nenhum registro no período selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>{formatDiaSemana(r.date)}</TableCell>
                          <TableCell>{(r.classId && classById.get(r.classId)?.nome) || "-"}</TableCell>
                          <TableCell>
                            <span className={r.status === "PRESENT" ? "text-success font-medium" : "text-destructive font-medium"}>
                              {r.status === "PRESENT" ? "Presente" : "Falta"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Registros</p>
                  <p className="text-lg font-bold text-foreground">{resumo.total}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Presenças</p>
                  <p className="text-lg font-bold text-success">{resumo.presencas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Faltas</p>
                  <p className="text-lg font-bold text-destructive">{resumo.faltas}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">% Presença</p>
                  <p className="text-lg font-bold text-foreground">{resumo.percentual}%</p>
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
