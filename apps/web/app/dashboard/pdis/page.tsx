"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RequirePermission } from "@/components/auth/require-permission"
import { PERMISSIONS } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Brain, Search, Users, TrendingUp, ClipboardList, AlertTriangle, ChevronRight, Plus } from "lucide-react"
import { getPdiDashboard, getStudents, getClasses, type PdiDashboardItem } from "@/lib/api"
import { PDI_AREAS, PDI_STATUSES, PDI_STALE_DAYS, PDI_DEADLINE_WARNING_DAYS, getPdiArea, getPdiStatus, getOverallPdiStatus } from "@/lib/pdi-constants"
import { PdiStatusBadge } from "@/components/pdi/pdi-status-badge"
import type { Aluno, Turma } from "@/lib/types"
import { toast } from "sonner"

const normalizeText = (str: string) =>
  (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Dashboard só lista quem já tem PDI - este diálogo é o ponto de entrada para começar o PDI
// de uma criança que ainda não tem um (busca em todas as crianças cadastradas, não só nas
// que já aparecem nos cards).
function SelecionarCriancaDialog({
  students,
  studentsComPdi,
}: {
  students: Aluno[]
  studentsComPdi: Set<string>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState("")

  const resultados = students
    .filter((s) => normalizeText(s.nome).includes(normalizeText(busca)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setBusca("")
      }}
    >
      <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shrink-0">
        <Plus className="h-4 w-4 mr-2" />
        Criar PDI de uma criança
      </Button>
      <DialogContent className="max-w-md bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Selecionar criança</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha a criança para criar o PDI ou continuar um já existente.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma criança encontrada.</p>
          ) : (
            resultados.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/dashboard/pdis/${s.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 text-left transition-colors"
              >
                <Avatar className="h-8 w-8 border border-border overflow-hidden shrink-0">
                  {s.fotoUrl ? (
                    <img src={s.fotoUrl} alt={s.nome} className="h-full w-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {s.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="flex-1 text-sm text-foreground truncate">{s.nome}</span>
                {studentsComPdi.has(s.id) && (
                  <span className="text-[10px] text-muted-foreground shrink-0">já possui PDI</span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function PdisPage() {
  const [pdis, setPdis] = useState<PdiDashboardItem[]>([])
  const [students, setStudents] = useState<Aluno[]>([])
  const [classes, setClasses] = useState<Turma[]>([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState("")
  const [filtroArea, setFiltroArea] = useState("todas")
  const [filtroStatus, setFiltroStatus] = useState("todos")
  const [filtroTurma, setFiltroTurma] = useState("todas")
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos")

  useEffect(() => {
    const load = async () => {
      try {
        const [pdisData, studentsData, classesData] = await Promise.all([
          getPdiDashboard(),
          getStudents(),
          getClasses(),
        ])
        setPdis(pdisData)
        setStudents(studentsData)
        setClasses(classesData)
      } catch (error) {
        console.error("Erro ao carregar Central de PDIs:", error)
        toast.error("Erro ao carregar a Central de PDIs.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  const totalComPdi = pdis.length
  const evolucaoPositiva = pdis.filter((p) => p.tracking.some((t) => t.status === "evolucao_positiva")).length
  const emAcompanhamento = pdis.filter((p) => p.tracking.length > 0).length
  const necessitamAtencao = pdis.filter((p) => p.tracking.some((t) => t.status === "atencao")).length

  const alertasSemAtualizacao = pdis.filter((p) => daysSince(p.updatedAt) > PDI_STALE_DAYS)
  const alertasAtencao = pdis.filter((p) => p.tracking.some((t) => t.status === "atencao"))
  const alertasPrazo = pdis.filter((p) =>
    p.tracking.some((t) => t.prazo && daysSince(t.prazo) >= -PDI_DEADLINE_WARNING_DAYS && daysSince(t.prazo) <= 0)
  )
  const totalAlertas = new Set([...alertasSemAtualizacao, ...alertasAtencao, ...alertasPrazo].map((p) => p.studentId)).size

  // Uma linha por criança em alerta, com o motivo principal - clicável, item 18 do pedido.
  const alertasPorCrianca = Array.from(new Set([...alertasAtencao, ...alertasSemAtualizacao, ...alertasPrazo].map((p) => p.studentId)))
    .map((studentId) => {
      const pdi = pdis.find((p) => p.studentId === studentId)!
      const areaAtencao = pdi.tracking.find((t) => t.status === "atencao")
      const motivo = areaAtencao
        ? `${getPdiArea(areaAtencao.area).label} necessita atenção`
        : alertasSemAtualizacao.some((p) => p.studentId === studentId)
          ? `Sem atualização há mais de ${PDI_STALE_DAYS} dias`
          : "Prazo de acompanhamento vencendo"
      return { studentId, motivo }
    })
    .sort((a, b) => {
      const na = studentById.get(a.studentId)?.nome || ""
      const nb = studentById.get(b.studentId)?.nome || ""
      return na.localeCompare(nb, "pt-BR", { sensitivity: "base" })
    })

  const turmasFiltro = classes.filter((c) => c.status === "ativa")

  const filtered = pdis.filter((p) => {
    const student = studentById.get(p.studentId)
    if (!student) return false
    const matchBusca = normalizeText(student.nome).includes(normalizeText(busca))
    const matchArea = filtroArea === "todas" || p.tracking.some((t) => t.area === filtroArea)
    const matchStatus = filtroStatus === "todos" || p.tracking.some((t) => t.status === filtroStatus)
    const studentClasses = classes.filter((c) => student.classIds?.includes(c.id))
    const matchTurma = filtroTurma === "todas" || studentClasses.some((c) => c.id === filtroTurma)
    let matchPeriodo = true
    if (filtroPeriodo !== "todos") {
      const dias = filtroPeriodo === "7d" ? 7 : filtroPeriodo === "30d" ? 30 : 90
      matchPeriodo = !!p.lastEvolutionAt && daysSince(p.lastEvolutionAt) <= dias
    }
    return matchBusca && matchArea && matchStatus && matchTurma && matchPeriodo
  })

  const filteredSorted = [...filtered].sort((a, b) => {
    const na = studentById.get(a.studentId)?.nome || ""
    const nb = studentById.get(b.studentId)?.nome || ""
    return na.localeCompare(nb, "pt-BR", { sensitivity: "base" })
  })

  const statCards = [
    { title: "Crianças com PDI", value: totalComPdi, icon: Brain, color: "text-primary", bgColor: "bg-primary/10" },
    { title: "Evolução positiva", value: evolucaoPositiva, icon: TrendingUp, color: "text-success", bgColor: "bg-success/10" },
    { title: "Em acompanhamento", value: emAcompanhamento, icon: ClipboardList, color: "text-chart-3", bgColor: "bg-chart-3/10" },
    { title: "Necessitam atenção", value: necessitamAtencao, icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" },
  ]

  return (
    <RequirePermission permission={PERMISSIONS.PDIS}>
      <div className="space-y-6 pt-12 md:pt-0 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Central de PDIs
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize, acompanhe e registre a evolução das crianças atendidas pela instituição.
            </p>
          </div>
          <SelecionarCriancaDialog students={students} studentsComPdi={new Set(pdis.map((p) => p.studentId))} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="border-border/50 py-0">
                <CardContent className="p-3 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">{stat.title}</p>
                      <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mt-0.5 sm:mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${stat.bgColor}`}>
                      <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Alertas */}
        {totalAlertas > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {totalAlertas} {totalAlertas === 1 ? "criança precisa" : "crianças precisam"} de atenção
              </CardTitle>
              <CardDescription className="text-xs">
                {alertasAtencao.length > 0 && `${alertasAtencao.length} com área marcada como "necessita atenção"`}
                {alertasSemAtualizacao.length > 0 && ` · ${alertasSemAtualizacao.length} sem atualização há mais de ${PDI_STALE_DAYS} dias`}
                {alertasPrazo.length > 0 && ` · ${alertasPrazo.length} com prazo de acompanhamento vencendo`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {alertasPorCrianca.map(({ studentId, motivo }) => {
                const nome = studentById.get(studentId)?.nome || "Criança"
                return (
                  <Link
                    key={studentId}
                    href={`/dashboard/pdis/${studentId}`}
                    className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 -mx-2 rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    <span className="text-foreground font-medium truncate">{nome}</span>
                    <span className="text-xs text-muted-foreground text-right shrink-0">{motivo}</span>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Busca e Filtros */}
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar criança..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filtroArea} onValueChange={setFiltroArea}>
                <SelectTrigger className="w-full sm:w-48">
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
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {PDI_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.emoji} {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroTurma} onValueChange={setFiltroTurma}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as turmas</SelectItem>
                  {turmasFiltro.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer período</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de crianças */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Carregando...</p>
        ) : filteredSorted.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
              <p className="font-semibold">Nenhuma criança encontrada</p>
              <p className="text-sm mt-1">
                {pdis.length === 0
                  ? 'Nenhuma criança possui PDI cadastrado ainda. Clique em "Criar PDI de uma criança" para começar.'
                  : "Tente ajustar a busca ou os filtros."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSorted.map((p) => {
              const student = studentById.get(p.studentId)
              if (!student) return null
              const overall = p.tracking.length > 0 ? getOverallPdiStatus(p.tracking) : null
              return (
                <Card key={p.id} className="border-border/50 hover:shadow-md transition-all duration-300 flex flex-col">
                  <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                    {/* Cabeçalho: avatar + nome + data (nome com largura total, sem a badge disputando espaço) */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 border border-border overflow-hidden shrink-0">
                        {student.fotoUrl ? (
                          <img src={student.fotoUrl} alt={student.nome} className="h-full w-full object-cover" />
                        ) : (
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {student.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate" title={student.nome}>{student.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.lastUpdateAt
                            ? `Atualizado: ${new Date(p.lastUpdateAt + "T12:00:00").toLocaleDateString("pt-BR")}${p.lastUpdateLabel ? ` · ${p.lastUpdateLabel}` : ""}`
                            : `Atualizado em ${new Date(p.updatedAt).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                    </div>

                    {/* Status geral + áreas, tudo numa linha que quebra bem */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {overall && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${overall.bg} ${overall.color}`}
                        >
                          {overall.emoji} {overall.label}
                        </span>
                      )}
                      {p.tracking.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Nenhuma área em acompanhamento</span>
                      ) : (
                        p.tracking.map((t) => {
                          const area = getPdiArea(t.area)
                          const status = getPdiStatus(t.status)
                          return (
                            <span
                              key={t.area}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${status.bg} ${status.color}`}
                              title={`${area.label}: ${status.label}`}
                            >
                              {area.emoji} {status.emoji}
                            </span>
                          )
                        })
                      )}
                    </div>

                    <div className="flex-1" />

                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/dashboard/pdis/${p.studentId}`}>
                        Ver PDI
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </RequirePermission>
  )
}
