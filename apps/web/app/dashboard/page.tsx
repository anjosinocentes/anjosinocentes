"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, BookOpen, TrendingUp, AlertTriangle, LayoutDashboard, Cake, CalendarClock } from "lucide-react"
import { getStudentsStats, getReportsStats, getStudents, getEvents, type StudentStats } from "@/lib/api"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { useAuth } from "@/components/auth/auth-provider"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import type { Evento } from "@/lib/types"

// Extrai mês (0-11) e dia de uma data em "yyyy-mm-dd", ISO ou "dd/mm/aaaa".
function parseMonthDay(value?: string): { mes: number; dia: number } | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [, m, d] = value.slice(0, 10).split("-").map(Number)
    return m && d ? { mes: m - 1, dia: d } : null
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m] = value.split("/").map(Number)
    return m && d ? { mes: m - 1, dia: d } : null
  }
  const dt = new Date(value)
  return isNaN(dt.getTime()) ? null : { mes: dt.getMonth(), dia: dt.getDate() }
}

const TIPO_EVENTO_LABEL: Record<string, string> = {
  aula: "Aula",
  evento: "Evento",
  reuniao: "Reunião",
  feriado: "Feriado",
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const chartConfig = {
  presentes: {
    label: "Presentes",
    color: "var(--color-success)",
  },
  ausentes: {
    label: "Ausentes",
    color: "var(--color-destructive)",
  },
}

interface DashboardData {
  presentesHoje: number
  totalAlunos: number
  novosCadastros: number
  atividadesRecentes: Array<{
    tipo: string
    descricao: string
    tempo: string
  }>
  riskStudents: Array<{
    id: string
    nome: string
    curso: string
    mediaNotas: number | null
    frequencia: number | null
    motivo: string
  }>
}

export default function DashboardPage() {
  const { user } = useAuth()
  // Atalhos do "Acesso Rápido" só aparecem para quem tem a permissão correspondente
  // (ADMIN/DIRECTOR sempre; demais cargos conforme as permissões liberadas em Equipe).
  const canAlunos = hasPermission(user, PERMISSIONS.ALUNOS)
  const canPresenca = hasPermission(user, PERMISSIONS.PRESENCA)
  const canAulas = hasPermission(user, PERMISSIONS.PLANO_AULA)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [reportsData, setReportsData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aniversariantes, setAniversariantes] = useState<Array<{ nome: string; label: string }>>([])
  const [proximosEventos, setProximosEventos] = useState<Evento[]>([])
  // Só renderiza o gráfico depois do primeiro layout: no mobile o ResponsiveContainer chega a
  // medir largura 0 no primeiro paint, empilhando todas as barras no mesmo x e gerando keys
  // duplicadas no Recharts (warning "same key rectangle-..."). Esperar 1 frame garante largura real.
  const [chartReady, setChartReady] = useState(false)
  useEffect(() => {
    // Efeito roda após o primeiro commit/layout (o placeholder de mesma altura já deu largura ao
    // container). Assim o gráfico só monta no 2º render, com largura real - evita o render de
    // largura 0 que duplicava as keys no mobile. (useEffect não é throttlado como o rAF em abas ocultas.)
    setChartReady(true)
  }, [])

  useEffect(() => {
    Promise.all([getStudentsStats(), getReportsStats()])
      .then(([stats, reports]) => {
        const hoje = new Date()
        const atividadesRecentes = (stats.recentStudents || []).slice(0, 4).map((student) => {
          const createdDate = new Date(student.createdAt)
          const diffTime = Math.abs(hoje.getTime() - createdDate.getTime())
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          let tempo = diffDays === 1 ? "1 dia atrás" : `${diffDays} dias atrás`
          if (diffDays === 0) tempo = "hoje"
          return {
            tipo: "cadastro",
            descricao: `Nova criança cadastrada: ${student.name}`,
            tempo
          }
        })

        setDashboardData({
          totalAlunos: stats.totalCount,
          novosCadastros: stats.newRegistrations7d,
          presentesHoje: stats.presentToday || 0,
          atividadesRecentes,
          riskStudents: stats.riskStudents || []
        })
        setReportsData(reports)
      })
      .catch((err) => {
        console.error(err)
        setError("Erro ao carregar dados. Verifique a conexão com o servidor.")
      })
  }, [])

  // Aniversariantes do mês atual + próximos eventos do calendário
  useEffect(() => {
    getStudents()
      .then((alunos) => {
        const mesAtual = new Date().getMonth()
        const lista = alunos
          .map((a) => {
            const md = parseMonthDay(a.dataNascimento)
            return md ? { nome: a.nome, mes: md.mes, dia: md.dia } : null
          })
          .filter((x): x is { nome: string; mes: number; dia: number } => !!x && x.mes === mesAtual)
          .sort((a, b) => a.dia - b.dia)
          .map((x) => ({
            nome: x.nome,
            label: `${String(x.dia).padStart(2, "0")}/${String(mesAtual + 1).padStart(2, "0")}`,
          }))
        setAniversariantes(lista)
      })
      .catch(() => {})

    getEvents()
      .then((eventos) => {
        const hojeStr = new Date().toISOString().slice(0, 10)
        const prox = (eventos || [])
          .filter((e) => typeof e.data === "string" && e.data >= hojeStr)
          .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
          .slice(0, 5)
        setProximosEventos(prox)
      })
      .catch(() => {})
  }, [])

  const totalAlunos = dashboardData?.totalAlunos || 0
  const novosCadastros = dashboardData?.novosCadastros || 0
  const atividadesRecentes = dashboardData?.atividadesRecentes || []
  const totalPresentes = dashboardData?.presentesHoje || 0
  

  const statCards = [
    {
      title: "Total de Crianças",
      value: totalAlunos.toString(),
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Novos Cadastros (7d)",
      value: novosCadastros.toString(),
      icon: Users,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Presentes Hoje",
      value: totalPresentes.toString(),
      icon: UserCheck,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Turmas Ativas",
      value: (reportsData?.activeClasses ?? 0).toString(),
      icon: BookOpen,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ]



  return (
    <div className="space-y-6 pt-12 md:pt-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"><LayoutDashboard className="h-7 w-7 text-primary" />Dashboard</h1>
        {error && (
          <p className="text-destructive font-medium mt-2 p-2 bg-destructive/10 rounded-md">
            {error}
          </p>
        )}
        <p className="text-muted-foreground mt-1">
          Visão geral do Projeto Anjos Inocentes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="border-border/50 py-0">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                      {stat.title}
                    </p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mt-0.5 sm:mt-1">
                      {stat.value}
                    </p>
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

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle>Frequência Mensal (%)</CardTitle>
            <CardDescription>
              Acompanhamento da taxa de presença das crianças nos últimos 6 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartReady ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(reportsData?.presencaMensal?.slice(-6) || [
                  { mes: "Hoje", presentes: totalPresentes ? Math.round((totalPresentes / totalAlunos) * 100) : 0, ausentes: totalPresentes ? 100 - Math.round((totalPresentes / totalAlunos) * 100) : 100 }
                ]).map((m: any) => (m.semRegistro ? { ...m, presentes: null, ausentes: null } : m))}>
                  <XAxis 
                    dataKey="mes" 
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                    unit="%"
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    dataKey="presentes"
                    fill="var(--color-success)"
                    radius={[4, 4, 0, 0]}
                    name="Presentes (%)"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="ausentes"
                    fill="var(--color-destructive)"
                    radius={[4, 4, 0, 0]}
                    name="Ausentes (%)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
            ) : (
              <div className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>
              Últimas ações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {atividadesRecentes.map((atividade, index) => (
                <div key={index} className="flex items-start gap-3 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    atividade.tipo === 'cadastro' ? 'bg-primary' :
                    atividade.tipo === 'presenca' ? 'bg-success' : 'bg-chart-3'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">
                      {atividade.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {atividade.tempo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Students Alerts */}
      {dashboardData && dashboardData.riskStudents && dashboardData.riskStudents.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-lg">Crianças Necessitando de Atenção Acadêmica</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Crianças com frequência abaixo de 75% ou média de notas inferior a 7.0
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="rounded-md border border-destructive/20 overflow-x-auto bg-card/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-destructive/10 hover:bg-destructive/15">
                    <TableHead className="font-semibold text-foreground">Criança</TableHead>
                    <TableHead className="font-semibold text-foreground">Oficina</TableHead>
                    <TableHead className="font-semibold text-foreground">Média Notas (0-10)</TableHead>
                    <TableHead className="font-semibold text-foreground">Frequência (%)</TableHead>
                    <TableHead className="font-semibold text-foreground">Motivo do Alerta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.riskStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-destructive/5 border-destructive/10">
                      <TableCell className="font-medium text-foreground">{student.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.curso}</TableCell>
                      <TableCell>
                        {student.mediaNotas !== null ? (
                          <span className={`font-bold text-sm ${student.mediaNotas >= 7.0 ? "text-success" : "text-destructive"}`}>
                            {student.mediaNotas}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem notas</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.frequencia !== null ? (
                          <span className={`font-bold text-sm ${student.frequencia >= 75 ? "text-success" : "text-destructive"}`}>
                            {student.frequencia}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem frequência</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex px-2.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold text-xs border border-destructive/25">
                          {student.motivo}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aniversariantes + Próximos eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cake className="h-4 w-4 text-primary" />
              Aniversariantes do mês
            </CardTitle>
            <CardDescription>Crianças que fazem aniversário este mês</CardDescription>
          </CardHeader>
          <CardContent>
            {aniversariantes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum aniversariante este mês.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {aniversariantes.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground truncate">{a.nome}</span>
                    <span className="text-muted-foreground shrink-0">{a.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Próximos eventos
            </CardTitle>
            <CardDescription>Os próximos eventos do calendário</CardDescription>
          </CardHeader>
          <CardContent>
            {proximosEventos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum evento futuro.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {proximosEventos.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR")}
                        {e.horario ? ` · ${e.horario}` : ""}
                        {e.tipo ? ` · ${TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      {(canAlunos || canPresenca || canAulas) && (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Acesso Rápido</CardTitle>
          <CardDescription>
            Atalhos para as principais funcionalidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {canAlunos && (
              <a
                href="/dashboard/criancas"
                className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors"
              >
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Cadastrar Criança</p>
                  <p className="text-sm text-muted-foreground">Adicionar nova criança</p>
                </div>
              </a>
            )}
            {canPresenca && (
              <a
                href="/dashboard/presenca"
                className="flex items-center gap-3 p-4 rounded-lg bg-success/5 hover:bg-success/10 border border-success/20 transition-colors"
              >
                <UserCheck className="h-8 w-8 text-success" />
                <div>
                  <p className="font-medium text-foreground">Registrar Presença</p>
                  <p className="text-sm text-muted-foreground">Controle de presença</p>
                </div>
              </a>
            )}
            {canAulas && (
              <a
                href="/dashboard/plano-aula"
                className="flex items-center gap-3 p-4 rounded-lg bg-chart-3/5 hover:bg-chart-3/10 border border-chart-3/20 transition-colors"
              >
                <BookOpen className="h-8 w-8 text-chart-3" />
                <div>
                  <p className="font-medium text-foreground">Aulas</p>
                  <p className="text-sm text-muted-foreground">Registrar aula dada</p>
                </div>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
