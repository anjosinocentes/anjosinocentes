export interface Aluno {
  id: string
  nome: string
  cpf: string
  dataNascimento: string
  email: string
  telefone: string
  telefoneResponsavel?: string
  endereco: string
  curso: string
  classId?: string | null
  classIds?: string[]
  fotoUrl?: string | null
  // Usados no cabeçalho do PDI (lib/pdi-server-utils.ts) - ficam no cadastro da criança para
  // não duplicar dado entre Crianças e PDI, ver item 8 do pedido de ajuste da Central de PDIs.
  escola?: string
  nomeResponsavel?: string
  dataAcolhimento?: string
  createdAt: string
}

export interface StudentAttachment {
  id: string
  studentId: string
  name: string
  type: string
  extension: string
  size: number
  data: string
  uploadedBy?: string | null
  createdAt: string
}

export interface Pdi {
  id: string
  studentId: string
  situacaoInicial: string
  objetivosIniciais?: string
  observacoesIniciais?: string
  attachments?: PdiEvolutionAttachment[]
  eventos?: PdiEvent[]
  createdAt: string
  createdBy?: string | null
  createdByName?: string | null
  updatedAt: string
  updatedBy?: string | null
  updatedByName?: string | null
}

// Marco geral da linha do tempo (ex.: visita domiciliar) - não é atrelado a uma área
// acompanhada, ao contrário de PdiEvolution. Ver "Linha do tempo geral" no PDI individual.
export interface PdiEvent {
  id: string
  data: string
  titulo: string
  descricao?: string
  createdAt: string
  createdBy?: string | null
  createdByName?: string | null
}

export interface PdiTracking {
  id: string
  pdiId: string
  studentId: string
  area: string
  objetivo: string
  descricao?: string
  dataInicio: string
  prazo?: string | null
  status: string
  responsavelId?: string | null
  responsavelNome?: string | null
  observacoes?: string
  createdAt: string
  updatedAt: string
}

export interface PdiEvolutionAttachment {
  name: string
  type: string
  data: string
  size: number
}

export interface PdiEvolution {
  id: string
  pdiId: string
  studentId: string
  area: string
  status: string
  data: string
  relato: string
  proximosPassos?: string
  responsavelId?: string | null
  responsavelNome?: string | null
  attachments?: PdiEvolutionAttachment[]
  createdAt: string
}

export interface Presenca {
  id: string
  alunoId: string
  data: string
  status: 'presente' | 'ausente'
}

// Material anexado a uma aula (slide, PDF, Word, imagem): guardado embutido como base64.
export interface LessonFile {
  name: string
  type: string
  data: string // data: URL (base64)
}

export interface PlanoAula {
  id: string
  data: string
  endDate?: string
  turma: string
  classId?: string
  disciplina: string
  conteudo: string
  observacoes: string
  files?: LessonFile[]
  createdAt: string
}

export interface DashboardStats {
  totalAlunos: number
  presentesHoje: number
  aulasDoDia: number
}

export interface Turma {
  id: string
  nome: string
  curso: string
  courseId?: string
  horario: string
  diasSemana: string[]
  professor: string
  professorId?: string
  capacidade: number
  alunosMatriculados: number
  sala: string
  status: 'ativa' | 'inativa'
  studentIds?: string[]
  createdAt: string
}

export interface Evento {
  id: string
  titulo: string
  descricao: string
  data: string
  horario: string
  tipo: 'aula' | 'evento' | 'feriado' | 'reuniao'
  turmaId?: string
  // 'publico' aparece para todos; 'privado' só para quem criou. Legados (sem o campo) = públicos.
  visibilidade?: 'publico' | 'privado'
  ownerId?: string
  ownerName?: string
}

export interface Course {
  id: string
  name: string
  description?: string
}

export interface Teacher {
  id: string
  name: string
  email: string
  role?: string
  permissions: string[]
  active: boolean
  cpf?: string
  telefone?: string
  dataNascimento?: string
  endereco?: string
  createdAt: string
}

export interface AnnouncementAttachment {
  name: string
  type: string
  data: string
  size: number
}

export type AnnouncementTipo = 'informativo' | 'importante' | 'urgente'

export interface Announcement {
  id: string
  title: string
  body: string
  tipo?: AnnouncementTipo
  attachments?: AnnouncementAttachment[]
  author?: {
    id: string
    name: string
    role: string
  } | null
  createdAt: string
}

export interface Nota {
  id: string
  studentId: string
  studentName?: string
  classId: string
  disciplina: string
  tipo: 'prova' | 'trabalho' | 'participacao' | 'outro'
  nota: number
  notaMaxima: number
  data: string
  observacoes: string
  professorId?: string
  professor?: string
  createdAt: string
}
