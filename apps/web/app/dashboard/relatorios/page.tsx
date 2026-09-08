"use client"

import { csvCell } from "@/lib/csv"

import { useState, useEffect } from "react"
import { getReportsStats, getStudents, getClasses } from "@/lib/api"
import {
  BarChart3,
  Download,
  Users,
  ClipboardCheck,
  Calendar,
  TrendingUp,
  TrendingDown,
  Printer,
  FileText,
  Layers,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useAuth } from "@/components/auth/auth-provider"
import { AccessDenied } from "@/components/auth/access-denied"
import { Spinner } from "@/components/ui/spinner"
import { API_URL } from "@/lib/auth"
import { RelatorioPresencaAluno } from "@/components/reports/relatorio-presenca-aluno"
import { RelatorioPresencaTurma } from "@/components/reports/relatorio-presenca-turma"
import { RelatorioFichaAluno } from "@/components/reports/relatorio-ficha-aluno"
import { RelatorioFrequenciaTurmas } from "@/components/reports/relatorio-frequencia-turmas"
import { RelatorioInstitucional } from "@/components/reports/relatorio-institucional"
import { RelatorioPdiAluno } from "@/components/reports/relatorio-pdi-aluno"
import type { Aluno, Turma } from "@/lib/types"

// Central de Relatórios: por ora, somente os dois relatórios de presença abaixo (o antigo grid
// de 4 exportações - presença mensal agregada, lista CSV, ocupação de turmas, eventos - foi
// removido a pedido, mantendo só o que está listado aqui).
const centralDeRelatorios = [
  {
    id: 'ficha-aluno' as const,
    titulo: 'Ficha Cadastral do Aluno',
    descricao: 'Todos os dados de cadastro de uma criança, para imprimir ou salvar em PDF',
    icon: FileText,
  },
  {
    id: 'pdi-aluno' as const,
    titulo: 'Relatório de PDI do Aluno',
    descricao: 'Plano de Desenvolvimento Individual: situação inicial, áreas e evoluções',
    icon: Target,
  },
  {
    id: 'presenca-aluno' as const,
    titulo: 'Presença por Aluno',
    descricao: 'Consulta a frequência individual de uma criança',
    icon: Calendar,
  },
  {
    id: 'presenca-turma' as const,
    titulo: 'Presença por Turma',
    descricao: 'Consulta a frequência de todos os alunos de uma turma',
    icon: Users,
  },
  {
    id: 'frequencia-turmas' as const,
    titulo: 'Frequência por Turma (Consolidado)',
    descricao: 'Taxa de presença de todas as turmas no período, lado a lado',
    icon: Layers,
  },
  {
    id: 'institucional' as const,
    titulo: 'Relatório Institucional Consolidado',
    descricao: 'Visão geral (crianças, matrículas, frequência, oficinas) para prestação de contas',
    icon: BarChart3,
  },
]

export default function RelatoriosPage() {
  const [periodoPresenca, setPeriodoPresenca] = useState('semestre')
  const [periodoMatriculas, setPeriodoMatriculas] = useState('semestre')
  const { user, loading } = useAuth()
  const [reportsData, setReportsData] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const exportAlunosCSV = async () => {
    try {
      const res = await fetch(`${API_URL}/students`)
      const data = await res.json()
      const studentsList = data.students || []
      
      const headers = ["Nome", "CPF", "Data de Nascimento", "E-mail", "Telefone", "Telefone Responsável", "Endereço", "Oficina", "Data de Cadastro"]
      const rows = studentsList.map((s: any) => [
        s.nome,
        s.cpf,
        s.dataNascimento,
        s.email,
        s.telefone,
        s.telefoneResponsavel,
        s.endereco,
        s.curso,
        s.createdAt
      ])
      
      const csvContent = "\uFEFF" + [headers.map(csvCell).join(";"), ...rows.map((r: any) => r.map(csvCell).join(";"))].join("\n")
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `criancas_ativas_${new Date().toISOString().split("T")[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("Erro ao exportar crianças:", err)
      alert("Erro ao exportar crianças")
    }
  }

  const [relatorioAberto, setRelatorioAberto] = useState<string | null>(null)
  const [students, setStudents] = useState<Aluno[]>([])
  const [classes, setClasses] = useState<Turma[]>([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await getReportsStats()
        setReportsData(stats)
      } catch (error) {
        console.error("Erro ao carregar relatórios:", error)
      } finally {
        setLoadingStats(false)
      }
    }
    loadStats()
  }, [])

  useEffect(() => {
    const loadFiltros = async () => {
      try {
        const [studentsData, classesData] = await Promise.all([getStudents(), getClasses()])
        setStudents(studentsData)
        setClasses(classesData)
      } catch (error) {
        console.error("Erro ao carregar crianças/turmas para os relatórios de presença:", error)
      }
    }
    loadFiltros()
  }, [])

  if (loading || loadingStats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (user.role !== "ADMIN" && user.role !== "DIRECTOR") {
    return <AccessDenied />
  }

  const distribuicaoCursos = reportsData?.courseDistribution ?? []

  // O backend sempre devolve os últimos 12 meses; o período selecionado só recorta
  // quantos desses meses entram no gráfico e nos totais.
  const mesesPorPeriodo: Record<string, number> = { trimestre: 3, semestre: 6, ano: 12 }
  const todosPresenca = reportsData?.presencaMensal ?? []
  const todosMatriculas = reportsData?.matriculasMensais ?? []
  const presencaMensal = todosPresenca.slice(-mesesPorPeriodo[periodoPresenca])
  const matriculasMensais = todosMatriculas.slice(-mesesPorPeriodo[periodoMatriculas])

  const totalAlunos = reportsData?.totalStudents ?? 0

  // Meses sem nenhum registro de presença não devem contar como "0% de presença" na média
  const presencaComRegistro = presencaMensal.filter((m: any) => !m.semRegistro)
  const mediaPresenca = presencaComRegistro.length > 0
    ? Math.round(presencaComRegistro.reduce((acc: number, m: any) => acc + m.presentes, 0) / presencaComRegistro.length)
    : 0
  const totalMatriculas = matriculasMensais.reduce((acc: number, m: any) => acc + m.matriculas, 0)

  // Variações reais mês a mês (em vez de percentuais fixos e fabricados)
  const ultimosDoisComRegistro = presencaComRegistro.slice(-2)
  const variacaoPresenca = ultimosDoisComRegistro.length === 2
    ? ultimosDoisComRegistro[1].presentes - ultimosDoisComRegistro[0].presentes
    : null

  const ultimosDoisMatriculas = todosMatriculas.slice(-2)
  const variacaoMatriculas = ultimosDoisMatriculas.length === 2 && ultimosDoisMatriculas[0].matriculas > 0
    ? Math.round(((ultimosDoisMatriculas[1].matriculas - ultimosDoisMatriculas[0].matriculas) / ultimosDoisMatriculas[0].matriculas) * 100)
    : null

  const matriculasEsteMes = todosMatriculas.length > 0 ? todosMatriculas[todosMatriculas.length - 1].matriculas : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" />Relatórios</h1>
          <p className="text-muted-foreground">Análises e métricas do projeto</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={exportAlunosCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Todos
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Crianças</p>
                <p className="text-2xl font-bold">{totalAlunos}</p>
                <div className="flex items-center gap-1 mt-1">
                  {matriculasEsteMes > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">+{matriculasEsteMes} este mês</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhuma matrícula este mês</span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média de Presença</p>
                <p className="text-2xl font-bold">{mediaPresenca}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {variacaoPresenca === null ? (
                    <span className="text-xs text-muted-foreground">Sem dados suficientes</span>
                  ) : variacaoPresenca >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">+{variacaoPresenca}pp vs mês anterior</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500">{variacaoPresenca}pp vs mês anterior</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <ClipboardCheck className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Novas Matrículas</p>
                <p className="text-2xl font-bold">{totalMatriculas}</p>
                <div className="flex items-center gap-1 mt-1">
                  {variacaoMatriculas === null ? (
                    <span className="text-xs text-muted-foreground">Sem dados suficientes</span>
                  ) : variacaoMatriculas >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">+{variacaoMatriculas}% vs mês anterior</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500">{variacaoMatriculas}% vs mês anterior</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Turmas Ativas</p>
                <p className="text-2xl font-bold">{reportsData?.activeClasses ?? 0}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">Cadastradas no sistema</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico de Presença */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Frequência de Presença</CardTitle>
                <CardDescription>Taxa de presença mensal (%)</CardDescription>
              </div>
              <Select value={periodoPresenca} onValueChange={setPeriodoPresenca}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="semestre">Semestre</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={presencaMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--popover-foreground)',
                    }}
                    labelStyle={{ color: 'var(--popover-foreground)' }}
                    itemStyle={{ color: 'var(--popover-foreground)' }}
                  />
                  <Bar dataKey="presentes" name="Presentes" fill="#F97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ausentes" name="Ausentes" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição por Oficina */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Oficina</CardTitle>
            <CardDescription>Quantidade de crianças por área</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicaoCursos}
                    dataKey="alunos"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {distribuicaoCursos.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--popover-foreground)',
                    }}
                    labelStyle={{ color: 'var(--popover-foreground)' }}
                    itemStyle={{ color: 'var(--popover-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {distribuicaoCursos.map((curso: any) => (
                <div key={curso.nome} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: curso.color }} />
                  <span className="text-xs text-muted-foreground">{curso.nome}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Matrículas */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Evolução de Matrículas</CardTitle>
                <CardDescription>Novas matrículas por mês</CardDescription>
              </div>
              <Select value={periodoMatriculas} onValueChange={setPeriodoMatriculas}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="semestre">Semestre</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={matriculasMensais}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--popover-foreground)',
                    }}
                    labelStyle={{ color: 'var(--popover-foreground)' }}
                    itemStyle={{ color: 'var(--popover-foreground)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="matriculas"
                    name="Matrículas"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={{ fill: '#F97316', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Central de Relatórios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Central de Relatórios</CardTitle>
          <CardDescription>Selecione um relatório, escolha os filtros e gere o PDF ou imprima</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {centralDeRelatorios.map((relatorio) => {
              const Icon = relatorio.icon
              return (
                <button
                  key={relatorio.id}
                  onClick={() => setRelatorioAberto(relatorio.id)}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent/50 transition-colors text-left group w-full"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{relatorio.titulo}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{relatorio.descricao}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <RelatorioFichaAluno
        open={relatorioAberto === "ficha-aluno"}
        onOpenChange={(open) => setRelatorioAberto(open ? "ficha-aluno" : null)}
        students={students}
        classes={classes}
      />
      <RelatorioPdiAluno
        open={relatorioAberto === "pdi-aluno"}
        onOpenChange={(open) => setRelatorioAberto(open ? "pdi-aluno" : null)}
        students={students}
        classes={classes}
      />
      <RelatorioPresencaAluno
        open={relatorioAberto === "presenca-aluno"}
        onOpenChange={(open) => setRelatorioAberto(open ? "presenca-aluno" : null)}
        students={students}
        classes={classes}
      />
      <RelatorioPresencaTurma
        open={relatorioAberto === "presenca-turma"}
        onOpenChange={(open) => setRelatorioAberto(open ? "presenca-turma" : null)}
        students={students}
        classes={classes}
      />
      <RelatorioFrequenciaTurmas
        open={relatorioAberto === "frequencia-turmas"}
        onOpenChange={(open) => setRelatorioAberto(open ? "frequencia-turmas" : null)}
        classes={classes}
      />
      <RelatorioInstitucional
        open={relatorioAberto === "institucional"}
        onOpenChange={(open) => setRelatorioAberto(open ? "institucional" : null)}
      />
    </div>
  )
}
