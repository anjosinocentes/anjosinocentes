"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { RequirePermission } from "@/components/auth/require-permission"
import { PERMISSIONS, hasPermission } from "@/lib/permissions"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft,
  Brain,
  Paperclip,
  FileText,
  Printer,
  Plus,
  Trash2,
} from "lucide-react"
import {
  getStudents,
  getClasses,
  getStudentPdi,
  createPdiTracking,
  deletePdiTracking,
  deletePdiEvolution,
  deletePdiEvent,
  deleteStudentPdi,
  type StudentPdiDetail,
} from "@/lib/api"
import { PDI_AREAS, PDI_STATUSES, getPdiArea, getPdiStatus } from "@/lib/pdi-constants"
import { PdiStatusBadge } from "@/components/pdi/pdi-status-badge"
import { PdiAreaSummary } from "@/components/pdi/pdi-area-summary"
import { PdiTimeline } from "@/components/pdi/pdi-timeline"
import { PdiTrackingCard } from "@/components/pdi/pdi-tracking-card"
import { RegisterEvolutionDialog } from "@/components/pdi/register-evolution-dialog"
import { CreatePdiDialog } from "@/components/pdi/create-pdi-dialog"
import { EditPdiInitialDialog } from "@/components/pdi/edit-pdi-initial-dialog"
import { AddPdiEventDialog } from "@/components/pdi/add-pdi-event-dialog"
import { PdiGeneralTimeline, type GeneralTimelineItem } from "@/components/pdi/pdi-general-timeline"
import type { Aluno, Turma, PdiTracking, PdiEvolution, PdiEvent } from "@/lib/types"
import { shareOrSaveReportPdf, type ReportBlock } from "@/lib/report-print"
import { toast } from "sonner"

function AddTrackingDialog({
  studentId,
  existingAreas,
  onCreated,
}: {
  studentId: string
  existingAreas: string[]
  onCreated: (tracking: PdiTracking) => void
}) {
  const availableAreas = PDI_AREAS.filter((a) => !existingAreas.includes(a.key))
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [area, setArea] = useState<string>(availableAreas[0]?.key || "")
  const [objetivo, setObjetivo] = useState("")
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [prazo, setPrazo] = useState("")
  const [status, setStatus] = useState<string>(PDI_STATUSES[1].key)

  if (availableAreas.length === 0) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createPdiTracking(studentId, { area, objetivo, dataInicio, prazo: prazo || null, status })
      toast.success("Acompanhamento criado com sucesso!")
      onCreated(created)
      setOpen(false)
      setObjetivo("")
      setPrazo("")
    } catch (error) {
      console.error("Erro ao criar acompanhamento:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o acompanhamento.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Novo acompanhamento
      </Button>
      <DialogContent className="max-w-md bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo acompanhamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Área *</FieldLabel>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableAreas.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.emoji} {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Objetivo *</FieldLabel>
              <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={300} required />
            </Field>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel className="text-foreground font-medium">Data de início *</FieldLabel>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel className="text-foreground font-medium">Prazo</FieldLabel>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </Field>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Status</FieldLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PDI_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.emoji} {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter className="pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 font-semibold">
              {saving ? "Salvando..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function StudentPdiPage() {
  const params = useParams<{ studentId: string }>()
  const studentId = params.studentId
  const router = useRouter()
  const { user } = useAuth()

  const [student, setStudent] = useState<Aluno | null>(null)
  const [classes, setClasses] = useState<Turma[]>([])
  const [detail, setDetail] = useState<StudentPdiDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [filtroArea, setFiltroArea] = useState("todas")
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos")

  const [trackingToDelete, setTrackingToDelete] = useState<PdiTracking | null>(null)
  const [deletingTracking, setDeletingTracking] = useState(false)
  const [evolutionToDelete, setEvolutionToDelete] = useState<PdiEvolution | null>(null)
  const [deletingEvolution, setDeletingEvolution] = useState(false)
  const [eventIdToDelete, setEventIdToDelete] = useState<string | null>(null)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [confirmDeletePdiOpen, setConfirmDeletePdiOpen] = useState(false)
  const [deletingPdi, setDeletingPdi] = useState(false)

  const canDeleteEvolution = hasPermission(user, PERMISSIONS.PDIS)
  // Excluir o PDI inteiro é destrutivo: mesma restrição do backend (ADMIN/Diretor).
  const canDeletePdi = hasPermission(user, PERMISSIONS.PDIS)

  const loadAll = async () => {
    try {
      const [studentsData, classesData, pdiDetail] = await Promise.all([
        getStudents(),
        getClasses(),
        getStudentPdi(studentId),
      ])
      setStudent(studentsData.find((s) => s.id === studentId) || null)
      setClasses(classesData)
      setDetail(pdiDetail)
    } catch (error) {
      console.error("Erro ao carregar PDI:", error)
      toast.error("Erro ao carregar o PDI da criança.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  const studentClasses = useMemo(
    () => classes.filter((c) => student?.classIds?.includes(c.id)),
    [classes, student]
  )

  const filteredEvolutions = useMemo(() => {
    if (!detail) return []
    let list = detail.evolutions
    if (filtroArea !== "todas") list = list.filter((e) => e.area === filtroArea)
    if (filtroPeriodo !== "todos") {
      const dias = filtroPeriodo === "30d" ? 30 : filtroPeriodo === "90d" ? 90 : 365
      const limite = Date.now() - dias * 24 * 60 * 60 * 1000
      list = list.filter((e) => new Date(e.data + "T12:00:00").getTime() >= limite)
    }
    return list
  }, [detail, filtroArea, filtroPeriodo])

  // Linha do tempo GERAL (item 15): além do histórico por área acima, reúne evoluções + marcos
  // institucionais (eventos) + a entrada na instituição (derivada do cadastro da criança, não
  // duplicada aqui) num único feed cronológico, mais recente primeiro.
  const generalTimelineItems = useMemo<GeneralTimelineItem[]>(() => {
    if (!detail) return []
    const items: GeneralTimelineItem[] = []
    for (const ev of detail.evolutions) {
      const area = getPdiArea(ev.area)
      items.push({ key: `ev-${ev.id}`, data: ev.data, emoji: area.emoji, label: area.label, kind: "evolution" })
    }
    for (const evento of detail.pdi?.eventos || []) {
      items.push({
        key: `evento-${evento.id}`,
        data: evento.data,
        emoji: "📍",
        label: evento.titulo,
        descricao: evento.descricao,
        kind: "evento",
        eventId: evento.id,
      })
    }
    if (student?.dataAcolhimento) {
      items.push({ key: "entrada", data: student.dataAcolhimento, emoji: "🚪", label: "Entrada na instituição", kind: "entrada" })
    }
    return items.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  }, [detail, student])

  // Evolução por área (seção 8): sequência de status ao longo do tempo, mais antigo primeiro,
  // sem repetir o mesmo status seguidas vezes.
  const progressaoPorArea = useMemo(() => {
    if (!detail) return []
    const byArea = new Map<string, PdiEvolution[]>()
    for (const ev of detail.evolutions) {
      const list = byArea.get(ev.area) || []
      list.push(ev)
      byArea.set(ev.area, list)
    }
    return Array.from(byArea.entries()).map(([area, evs]) => {
      const sorted = [...evs].sort((a, b) => a.data.localeCompare(b.data))
      const sequence: { status: string; data: string }[] = []
      for (const ev of sorted) {
        if (sequence.length === 0 || sequence[sequence.length - 1].status !== ev.status) {
          sequence.push({ status: ev.status, data: ev.data })
        }
      }
      return { area, sequence }
    })
  }, [detail])

  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  const handleGerarRelatorio = async () => {
    if (!student || !detail?.pdi) return
    const pdi = detail.pdi
    const fmt = (d?: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-")
    const fmtIso = (d: string) => new Date(d).toLocaleDateString("pt-BR")

    const blocks: ReportBlock[] = [
      {
        type: "keyValue",
        rows: [
          ["Criança", student.nome],
          ["Data de nascimento", fmt(student.dataNascimento)],
          ["Escola", student.escola || "-"],
          ["Responsável", `${student.nomeResponsavel || "-"}${student.telefoneResponsavel ? ` (${student.telefoneResponsavel})` : ""}`],
          ["Data de acolhimento", fmt(student.dataAcolhimento)],
          ["PDI criado em", fmtIso(pdi.createdAt)],
          ["Última atualização", fmtIso(pdi.updatedAt)],
        ],
      },
      { type: "heading", text: "Histórico inicial" },
      { type: "text", text: pdi.situacaoInicial },
    ]

    if (pdi.objetivosIniciais) {
      blocks.push({ type: "heading", text: "Objetivos iniciais" }, { type: "text", text: pdi.objetivosIniciais })
    }
    if (pdi.observacoesIniciais) {
      blocks.push({ type: "heading", text: "Observações" }, { type: "text", text: pdi.observacoesIniciais })
    }

    blocks.push({ type: "heading", text: "Áreas acompanhadas" })
    if (detail.tracking.length > 0) {
      blocks.push({
        type: "table",
        head: ["Área", "Objetivo", "Situação atual"],
        rows: detail.tracking.map((t) => [getPdiArea(t.area).label, t.objetivo, getPdiStatus(t.status).label]),
      })
    } else {
      blocks.push({ type: "text", text: "Nenhuma área em acompanhamento." })
    }

    blocks.push({ type: "heading", text: "Linha do tempo geral" })
    if (generalTimelineItems.length > 0) {
      for (const item of generalTimelineItems) {
        blocks.push({
          type: "text",
          text: `${fmt(item.data)} - ${item.label}${item.descricao ? ` - ${item.descricao}` : ""}`,
        })
      }
    } else {
      blocks.push({ type: "text", text: "Nenhum acontecimento registrado." })
    }

    blocks.push({ type: "heading", text: "Registros de evolução por área" })
    if (detail.evolutions.length > 0) {
      for (const ev of detail.evolutions) {
        const parts = [
          `${fmt(ev.data)} - ${getPdiArea(ev.area).label} (${getPdiStatus(ev.status).label})`,
          ev.relato,
          ev.proximosPassos ? `Próximos passos: ${ev.proximosPassos}` : "",
          `Registrado por ${ev.responsavelNome || "equipe"}`,
        ].filter(Boolean)
        blocks.push({ type: "text", text: parts.join("\n") })
      }
    } else {
      blocks.push({ type: "text", text: "Nenhum registro de evolução." })
    }

    setGerandoRelatorio(true)
    try {
      const result = await shareOrSaveReportPdf({
        filename: `PDI - ${student.nome}`,
        subtitle: `Plano de Desenvolvimento Individual (PDI) - Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
        blocks,
        shareTitle: `PDI - ${student.nome}`,
      })
      if (result === "saved") toast.success("Relatório salvo com sucesso!")
      else if (result === "downloaded") toast.success("Relatório gerado! Verifique seus downloads.")
    } catch (error) {
      console.error("Erro ao gerar relatório do PDI:", error)
      toast.error("Não foi possível gerar o relatório. Tente novamente.")
    } finally {
      setGerandoRelatorio(false)
    }
  }

  const confirmDeleteTracking = async () => {
    if (!trackingToDelete) return
    setDeletingTracking(true)
    try {
      await deletePdiTracking(studentId, trackingToDelete.id)
      setDetail((prev) => (prev ? { ...prev, tracking: prev.tracking.filter((t) => t.id !== trackingToDelete.id) } : prev))
      toast.success("Acompanhamento excluído com sucesso!")
      setTrackingToDelete(null)
    } catch (error) {
      console.error("Erro ao excluir acompanhamento:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir acompanhamento.")
    } finally {
      setDeletingTracking(false)
    }
  }

  const confirmDeleteEvolution = async () => {
    if (!evolutionToDelete) return
    setDeletingEvolution(true)
    try {
      await deletePdiEvolution(studentId, evolutionToDelete.id)
      setDetail((prev) =>
        prev ? { ...prev, evolutions: prev.evolutions.filter((e) => e.id !== evolutionToDelete.id) } : prev
      )
      toast.success("Registro excluído com sucesso!")
      setEvolutionToDelete(null)
    } catch (error) {
      console.error("Erro ao excluir registro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir registro.")
    } finally {
      setDeletingEvolution(false)
    }
  }

  const confirmDeleteEvent = async () => {
    if (!eventIdToDelete) return
    setDeletingEvent(true)
    try {
      await deletePdiEvent(studentId, eventIdToDelete)
      setDetail((prev) =>
        prev && prev.pdi
          ? { ...prev, pdi: { ...prev.pdi, eventos: (prev.pdi.eventos || []).filter((e) => e.id !== eventIdToDelete) } }
          : prev
      )
      toast.success("Marco excluído com sucesso!")
      setEventIdToDelete(null)
    } catch (error) {
      console.error("Erro ao excluir marco:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir marco.")
    } finally {
      setDeletingEvent(false)
    }
  }

  const confirmDeletePdi = async () => {
    setDeletingPdi(true)
    try {
      await deleteStudentPdi(studentId)
      toast.success("PDI excluído com sucesso!")
      setConfirmDeletePdiOpen(false)
      router.push("/dashboard/pdis")
    } catch (error) {
      console.error("Erro ao excluir PDI:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir o PDI.")
      setDeletingPdi(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-3">
        <p className="text-lg font-semibold text-foreground">Criança não encontrada</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/pdis")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para a Central de PDIs
        </Button>
      </div>
    )
  }

  return (
    <RequirePermission permission={PERMISSIONS.PDIS}>
      <div className="space-y-6 pt-12 md:pt-0 animate-in fade-in duration-300">
        <Link href="/dashboard/pdis" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Central de PDIs
        </Link>

        {/* Cabeçalho */}
        <Card className="border-border/50">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar className="h-16 w-16 border border-border overflow-hidden shrink-0">
              {student.fotoUrl ? (
                <img src={student.fotoUrl} alt={student.nome} className="h-full w-full object-cover" />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {student.nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
              <div className="col-span-2 sm:col-span-4">
                <p className="text-lg font-bold text-foreground">{student.nome}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Data de nascimento</p>
                <p className="text-sm text-foreground">
                  {student.dataNascimento ? new Date(student.dataNascimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Turma(s)</p>
                <p className="text-sm text-foreground truncate">
                  {studentClasses.length > 0 ? studentClasses.map((c) => c.nome).join(", ") : "Não matriculado"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Escola</p>
                <p className="text-sm text-foreground truncate">{student.escola || "-"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Responsável</p>
                <p className="text-sm text-foreground truncate">
                  {student.nomeResponsavel || "-"}
                  {student.telefoneResponsavel ? ` · ${student.telefoneResponsavel}` : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Data de acolhimento</p>
                <p className="text-sm text-foreground">
                  {student.dataAcolhimento ? new Date(student.dataAcolhimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              {detail?.pdi && (
                <div>
                  <p className="text-[11px] text-muted-foreground">PDI criado em</p>
                  <p className="text-sm text-foreground">{new Date(detail.pdi.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              )}
            </div>
            {detail?.pdi && (
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button variant="outline" onClick={handleGerarRelatorio} disabled={gerandoRelatorio}>
                  <Printer className="h-4 w-4 mr-2" />
                  {gerandoRelatorio ? "Gerando..." : "Gerar relatório"}
                </Button>
                {canDeletePdi && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDeletePdiOpen(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir PDI
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {!detail?.pdi ? (
          <Card className="border-border/50">
            <CardContent className="py-16 text-center">
              <Brain className="h-14 w-14 mx-auto mb-4 opacity-30 text-primary" />
              <p className="font-semibold text-lg text-foreground">Esta criança ainda não possui um PDI cadastrado.</p>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Crie o PDI para começar a registrar a evolução desta criança.
              </p>
              <div className="flex justify-center">
                <CreatePdiDialog studentId={studentId} onCreated={() => loadAll()} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Histórico inicial */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">📋 Histórico inicial</CardTitle>
                  <CardDescription className="text-xs">Contexto que deu origem ao acompanhamento</CardDescription>
                </div>
                <EditPdiInitialDialog
                  studentId={studentId}
                  pdi={detail.pdi}
                  onUpdated={(updated) => setDetail((prev) => (prev ? { ...prev, pdi: updated } : prev))}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{detail.pdi.situacaoInicial}</p>
                {detail.pdi.objetivosIniciais && (
                  <div>
                    <p className="text-xs font-semibold text-foreground">Objetivos iniciais</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.pdi.objetivosIniciais}</p>
                  </div>
                )}
                {detail.pdi.observacoesIniciais && (
                  <div>
                    <p className="text-xs font-semibold text-foreground">Observações</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.pdi.observacoesIniciais}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo da evolução */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumo da evolução</CardTitle>
                <CardDescription className="text-xs">Situação atual de cada área acompanhada</CardDescription>
              </CardHeader>
              <CardContent>
                <PdiAreaSummary tracking={detail.tracking.map((t) => ({ area: t.area, status: t.status }))} />
              </CardContent>
            </Card>

            {/* Evolução por área */}
            {progressaoPorArea.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">📈 Evolução</CardTitle>
                  <CardDescription className="text-xs">Como cada área mudou ao longo do tempo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {progressaoPorArea.map(({ area, sequence }) => {
                    const areaInfo = getPdiArea(area)
                    return (
                      <div key={area} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-foreground shrink-0">
                          {areaInfo.emoji} {areaInfo.label}:
                        </span>
                        {sequence.map((s, idx) => (
                          <span key={idx} className="flex items-center gap-2">
                            {idx > 0 && <span className="text-muted-foreground">→</span>}
                            <PdiStatusBadge status={s.status} />
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(s.data + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          </span>
                        ))}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* Acompanhamentos */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">🎯 Acompanhamentos</CardTitle>
                  <CardDescription className="text-xs">Objetivos por área acompanhados pela equipe</CardDescription>
                </div>
                <AddTrackingDialog
                  studentId={studentId}
                  existingAreas={detail.tracking.map((t) => t.area)}
                  onCreated={(t) => setDetail((prev) => (prev ? { ...prev, tracking: [...prev.tracking, t] } : prev))}
                />
              </CardHeader>
              <CardContent>
                {detail.tracking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum acompanhamento criado ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {detail.tracking.map((t) => (
                      <PdiTrackingCard
                        key={t.id}
                        studentId={studentId}
                        tracking={t}
                        onUpdated={(updated) =>
                          setDetail((prev) =>
                            prev ? { ...prev, tracking: prev.tracking.map((x) => (x.id === updated.id ? updated : x)) } : prev
                          )
                        }
                        onRequestDelete={setTrackingToDelete}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linha do tempo geral: evoluções + marcos institucionais + entrada na instituição */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">🗺️ Linha do tempo geral</CardTitle>
                  <CardDescription className="text-xs">Acontecimentos importantes de todas as áreas</CardDescription>
                </div>
                <AddPdiEventDialog
                  studentId={studentId}
                  onCreated={(evento) =>
                    setDetail((prev) =>
                      prev && prev.pdi ? { ...prev, pdi: { ...prev.pdi, eventos: [...(prev.pdi.eventos || []), evento] } } : prev
                    )
                  }
                />
              </CardHeader>
              <CardContent>
                <PdiGeneralTimeline
                  items={generalTimelineItems}
                  canDeleteEvent={canDeleteEvolution}
                  onDeleteEvent={setEventIdToDelete}
                />
              </CardContent>
            </Card>

            {/* Linha do tempo por área */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">🗓️ Linha do tempo por área</CardTitle>
                    <CardDescription className="text-xs">Todos os registros, do mais recente ao mais antigo</CardDescription>
                  </div>
                  <RegisterEvolutionDialog
                    studentId={studentId}
                    defaultArea={filtroArea !== "todas" ? filtroArea : undefined}
                    onCreated={() => {
                      // Recarrega tudo (não só anexa localmente): registrar uma evolução também
                      // pode ter criado/atualizado o acompanhamento da área e a data do PDI.
                      loadAll()
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Select value={filtroArea} onValueChange={setFiltroArea}>
                    <SelectTrigger className="w-full sm:w-48 h-8 text-xs">
                      <SelectValue placeholder="Área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as áreas</SelectItem>
                      {PDI_AREAS.map((a) => (
                        <SelectItem key={a.key} value={a.key}>
                          {a.emoji} {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger className="w-full sm:w-48 h-8 text-xs">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Qualquer período</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="90d">Últimos 90 dias</SelectItem>
                      <SelectItem value="365d">Último ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <PdiTimeline
                  evolutions={filteredEvolutions}
                  canDelete={canDeleteEvolution}
                  onDelete={setEvolutionToDelete}
                />
              </CardContent>
            </Card>

            {/* Anexos iniciais do PDI */}
            {detail.pdi.attachments && detail.pdi.attachments.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-primary" />
                    Anexos do cadastro inicial
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {detail.pdi.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.data}
                      download={att.name}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {att.name}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Confirmar exclusão de acompanhamento */}
      <Dialog open={!!trackingToDelete} onOpenChange={(open) => { if (!open) setTrackingToDelete(null) }}>
        <DialogContent className="max-w-sm bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir Acompanhamento</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1">
              Tem certeza que deseja excluir o acompanhamento de{" "}
              <strong>{trackingToDelete && getPdiArea(trackingToDelete.area).label}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setTrackingToDelete(null)} disabled={deletingTracking} className="text-xs">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteTracking}
              disabled={deletingTracking}
              className="bg-destructive hover:bg-destructive/90 text-xs"
            >
              {deletingTracking ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de registro de evolução */}
      <Dialog open={!!evolutionToDelete} onOpenChange={(open) => { if (!open) setEvolutionToDelete(null) }}>
        <DialogContent className="max-w-sm bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir Registro</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1">
              Tem certeza que deseja excluir este registro de evolução? O histórico é a principal fonte de informação do PDI -
              essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEvolutionToDelete(null)} disabled={deletingEvolution} className="text-xs">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteEvolution}
              disabled={deletingEvolution}
              className="bg-destructive hover:bg-destructive/90 text-xs"
            >
              {deletingEvolution ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de marco */}
      <Dialog open={!!eventIdToDelete} onOpenChange={(open) => { if (!open) setEventIdToDelete(null) }}>
        <DialogContent className="max-w-sm bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir Marco</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1">
              Tem certeza que deseja excluir este marco da linha do tempo? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEventIdToDelete(null)} disabled={deletingEvent} className="text-xs">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteEvent}
              disabled={deletingEvent}
              className="bg-destructive hover:bg-destructive/90 text-xs"
            >
              {deletingEvent ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão do PDI inteiro */}
      <Dialog open={confirmDeletePdiOpen} onOpenChange={(open) => { if (!open && !deletingPdi) setConfirmDeletePdiOpen(false) }}>
        <DialogContent className="max-w-md bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir PDI</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1">
              Tem certeza que deseja excluir o PDI de <span className="font-semibold text-foreground">{student.nome}</span>?
              O PDI (histórico inicial, acompanhamentos, evoluções e marcos) vai para a <span className="font-semibold text-foreground">Lixeira</span> e
              pode ser restaurado por até <span className="font-semibold text-foreground">7 dias</span> na Central de PDIs. Depois disso é apagado definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setConfirmDeletePdiOpen(false)} disabled={deletingPdi} className="text-xs">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePdi}
              disabled={deletingPdi}
              className="bg-destructive hover:bg-destructive/90 text-xs"
            >
              {deletingPdi ? "Excluindo..." : "Excluir PDI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequirePermission>
  )
}
