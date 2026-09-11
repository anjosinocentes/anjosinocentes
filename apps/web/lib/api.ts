import { API_URL, refreshSession } from './auth'
import type { Aluno, Turma, Course, Evento, PlanoAula, Teacher, Announcement, AnnouncementAttachment, AnnouncementTipo, Nota, StudentAttachment, Pdi, PdiTracking, PdiEvolution, PdiEvent } from './types'

export type { Announcement, AnnouncementAttachment, AnnouncementTipo, Nota, StudentAttachment, Pdi, PdiTracking, PdiEvolution, PdiEvent }

export interface StudentStats {
  totalCount: number
  newRegistrations7d: number
  presentToday: number
  recentStudents: Array<{
    id: string
    name: string
    createdAt: string
  }>
  riskStudents?: Array<{
    id: string
    nome: string
    curso: string
    mediaNotas: number | null
    frequencia: number | null
    motivo: string
  }>
}



async function request<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  // A autenticação vai no cookie httpOnly `anjos_token`, enviado automaticamente nas chamadas
  // same-origin para /api. Não há mais token acessível ao JS para montar um header Authorization.
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  // Ensure production web app on Vercel routes to local serverless /api endpoint
  const targetApi = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? '/api'
    : (API_URL || '/api')

  const formattedPath = path.startsWith('/') ? path : `/${path}`
  const targetUrl = `${targetApi}${formattedPath}`

  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers,
    })
    // Access token expirado: renova via refresh e refaz a chamada uma única vez.
    if (res.status === 401 && !_retried && await refreshSession()) {
      return request(path, options, true)
    }
    const text = await res.text()
    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`)
    }
    return data
  } catch (err: any) {
    console.warn(`[API] Request to ${targetUrl} failed:`, err.message)
    if (path.includes('students')) return { students: [] } as unknown as T
    if (path.includes('classes')) return { classes: [] } as unknown as T
    if (path.includes('courses')) return { courses: [] } as unknown as T
    if (path.includes('teachers')) return { teachers: [] } as unknown as T
    if (path.includes('events')) return { events: [] } as unknown as T
    if (path.includes('lessons')) return { lessons: [] } as unknown as T
    if (path.includes('announcements')) return { announcements: [] } as unknown as T
    if (path.includes('stats')) return { stats: { totalAlunos: 0, presentesHoje: 0, aulasDoDia: 0 }, weeklyPresenca: [], riskStudents: [] } as unknown as T
    return {} as T
  }
}
// Fetch mais rígido que request(): nunca engole erro num valor padrão silencioso. Usado onde
// o chamador precisa mesmo saber por que a chamada falhou (ex.: limite de anexos atingido),
// já que os fallbacks de request() fariam esses erros parecerem sucesso.
async function requestStrict<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  // Autenticação via cookie httpOnly `anjos_token` (enviado automaticamente); sem header Authorization.
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const targetApi = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? '/api'
    : (API_URL || '/api')
  const formattedPath = path.startsWith('/') ? path : `/${path}`

  const res = await fetch(`${targetApi}${formattedPath}`, { ...options, headers })
  // Access token expirado: renova via refresh e refaz a chamada uma única vez.
  if (res.status === 401 && !_retried && await refreshSession()) {
    return requestStrict(path, options, true)
  }
  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = {}
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`)
  }
  return data
}

// Students (Alunos)
export async function getStudents(): Promise<Aluno[]> {
  const data = await request<{ students: Aluno[] }>('/students')
  return data.students || []
}

// Mutações usam requestStrict (não request): erros do servidor - CPF duplicado (409), campo
// obrigatório (400), sem permissão (403) - precisam CHEGAR ao usuário como mensagem real. O
// request() "frouxo" engoliria o erro num payload vazio, fazendo uma falha parecer sucesso.
export async function createStudent(student: any): Promise<Aluno> {
  const data = await requestStrict<{ student: Aluno }>('/students', {
    method: 'POST',
    body: JSON.stringify(student),
  })
  return data.student
}

export async function updateStudent(id: string, student: any): Promise<void> {
  await requestStrict<void>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(student),
  })
}

export async function deleteStudent(id: string): Promise<void> {
  await requestStrict<void>(`/students/${id}`, {
    method: 'DELETE',
  })
}

// Anexos da criança
export async function getStudentAttachments(studentId: string): Promise<StudentAttachment[]> {
  const data = await requestStrict<{ attachments: StudentAttachment[] }>(`/students/${studentId}/attachments`)
  return data.attachments || []
}

export async function uploadStudentAttachments(
  studentId: string,
  files: { name: string; type: string; data: string; size: number }[]
): Promise<StudentAttachment[]> {
  const data = await requestStrict<{ attachments: StudentAttachment[] }>(`/students/${studentId}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ attachments: files }),
  })
  return data.attachments || []
}

export async function deleteStudentAttachment(studentId: string, attachmentId: string): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}

// Classes (Turmas)
export async function getClasses(): Promise<Turma[]> {
  const data = await request<{ classes: Turma[] }>('/classes')
  return data.classes || []
}

export async function createClass(classData: any): Promise<Turma> {
  const data = await request<{ class: Turma }>('/classes', {
    method: 'POST',
    body: JSON.stringify(classData),
  })
  return data.class
}

export async function updateClass(id: string, data: any): Promise<void> {
  await request<void>(`/classes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteClass(id: string): Promise<void> {
  await request<void>(`/classes/${id}`, {
    method: 'DELETE',
  })
}

// Courses (Cursos)
export async function getCourses(): Promise<Course[]> {
  const data = await request<{ courses: Course[] }>('/courses')
  return data.courses || []
}

export async function createCourse(course: any): Promise<Course> {
  const data = await request<{ course: Course }>('/courses', {
    method: 'POST',
    body: JSON.stringify(course),
  })
  return data.course
}

export async function updateCourse(id: string, course: any): Promise<void> {
  await request<void>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(course),
  })
}

export async function deleteCourse(id: string): Promise<void> {
  await request<void>(`/courses/${id}`, {
    method: 'DELETE',
  })
}

// Teachers (Professores)
export async function getTeachers(): Promise<Teacher[]> {
  const data = await request<{ teachers: Teacher[] }>('/users/teachers')
  return data.teachers || []
}

export async function updateTeacher(id: string, teacher: any): Promise<any> {
  return await request<any>(`/users/teachers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(teacher),
  })
}

export async function deleteTeacher(id: string): Promise<void> {
  await request<void>(`/users/teachers/${id}`, {
    method: 'DELETE',
  })
}

export async function resetPassword(id: string, payload: { password: string }): Promise<void> {
  await request<void>(`/users/teachers/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Profile & Password settings (Configurações)
export async function updateProfile(profile: any): Promise<any> {
  return await request<any>('/users/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}

export async function changePassword(payload: any): Promise<any> {
  return await request<any>('/users/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Stats & Reports
// /stats (base) devolve só CONTAGENS agregadas não sensíveis (sem nomes de crianças) e é aberto
// a qualquer usuário logado - usado no painel de quem NÃO tem permissão de Relatórios.
export type DashboardStats = {
  stats: { totalAlunos: number; presentesHoje: number; aulasDoDia: number }
  weeklyPresenca: { dia: string; presentes: number; ausentes: number }[]
  totalStudents?: number
  activeClasses?: number
}
export async function getDashboardStats(): Promise<DashboardStats> {
  return await request<DashboardStats>('/stats')
}

export async function getStudentsStats(): Promise<StudentStats> {
  return await request<StudentStats>('/stats/students')
}

export async function getReportsStats(): Promise<any> {
  return await request<any>('/stats/reports')
}

// Attendance (Presença)
export async function getAttendanceByDate(date: string, classId: string): Promise<Record<string, boolean>> {
  const data = await request<{ records: any[] }>(`/attendance?date=${date}&classId=${classId}`)
  const map: Record<string, boolean> = {}
  data.records.forEach(r => {
    const studentId = r.studentId || r.student_id
    map[studentId] = r.status === 'presente' || r.status === 'PRESENT'
  })
  return map
}

export async function saveAttendance(items: Array<{ alunoId: string; data: string; status: string; classId: string }>): Promise<void> {
  if (items.length === 0) return
  const date = items[0].data
  const classId = items[0].classId
  const records = items.map(item => ({
    studentId: item.alunoId,
    status: item.status === 'PRESENT' ? 'presente' : 'ausente',
  }))
  await request<void>('/attendance', {
    method: 'POST',
    body: JSON.stringify({ date, classId, records }),
  })
}

export interface AttendanceRecord {
  id: string
  studentId: string
  classId: string | null
  date: string
  status: string
}

// Busca genérica usada pelos relatórios de presença (por aluno e por turma) - aceita studentId
// e/ou classId, ao contrário de getAttendanceByDate/getAttendanceHistory, que são específicas
// da tela de Chamada.
export async function getAttendanceRecords(filters: {
  studentId?: string
  classId?: string
  startDate?: string
  endDate?: string
}): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams()
  if (filters.studentId) params.set('studentId', filters.studentId)
  if (filters.classId) params.set('classId', filters.classId)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  const data = await requestStrict<{ records: any[] }>(`/attendance?${params.toString()}`)
  return (data.records || []).map((r) => ({
    id: r.id,
    studentId: r.studentId || r.student_id,
    classId: r.classId || r.class_id || null,
    date: r.date,
    status: r.status === 'presente' || r.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }))
}

export async function getAttendanceHistory(classId: string, startDate: string, endDate: string): Promise<any[]> {
  const data = await request<{ records: any[] }>(`/attendance?classId=${classId}&startDate=${startDate}&endDate=${endDate}`)
  const records = data.records || []
  // A gravação salva o status em português minúsculo ('presente'/'ausente'), mas as telas de
  // histórico comparam com "PRESENT"/"ABSENT" - normaliza aqui para os dois formatos baterem.
  return records.map(r => ({
    ...r,
    status: r.status === 'presente' || r.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }))
}

// Lesson Plans (Planos de Aula)
export async function getLessonPlans(): Promise<PlanoAula[]> {
  const data = await request<{ lessons: PlanoAula[] }>('/lessons')
  return data.lessons || []
}

export async function createLessonPlan(plan: any): Promise<PlanoAula> {
  const data = await request<{ lesson: PlanoAula }>('/lessons', {
    method: 'POST',
    body: JSON.stringify(plan),
  })
  return data.lesson
}

export async function updateLessonPlan(id: string, plan: any): Promise<void> {
  await request<void>(`/lessons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(plan),
  })
}

export async function deleteLessonPlan(id: string): Promise<void> {
  await request<void>(`/lessons/${id}`, {
    method: 'DELETE',
  })
}

// Events (Calendário)
export async function getEvents(): Promise<Evento[]> {
  const data = await request<{ events: Evento[] }>('/events')
  return data.events || []
}

export async function createEvent(event: any): Promise<Evento> {
  const data = await request<{ event: Evento }>('/events', {
    method: 'POST',
    body: JSON.stringify(event),
  })
  return data.event
}

export async function updateEvent(id: string, event: any): Promise<void> {
  await request<void>(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(event),
  })
}

export async function deleteEvent(id: string): Promise<void> {
  await request<void>(`/events/${id}`, {
    method: 'DELETE',
  })
}

// Announcements (Avisos)
export async function getAnnouncements(): Promise<Announcement[]> {
  const data = await request<{ announcements: Announcement[] }>('/announcements')
  return data.announcements || []
}

export async function createAnnouncement(announcement: any): Promise<Announcement> {
  const data = await request<{ announcement: Announcement }>('/announcements', {
    method: 'POST',
    body: JSON.stringify(announcement),
  })
  return data.announcement
}

export async function updateAnnouncement(id: string, announcement: any): Promise<void> {
  await request<void>(`/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(announcement),
  })
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await request<void>(`/announcements/${id}`, {
    method: 'DELETE',
    body: undefined,
  })
}

// Grades (Notas)
export async function getGrades(classId?: string, studentId?: string): Promise<Nota[]> {
  let query = ''
  const params: string[] = []
  if (classId) params.push(`classId=${classId}`)
  if (studentId) params.push(`studentId=${studentId}`)
  if (params.length > 0) {
    query = `?${params.join('&')}`
  }
  const data = await request<{ grades: Nota[] }>(`/grades${query}`)
  return data.grades || []
}

export async function createGrade(grade: any): Promise<Nota> {
  const data = await request<{ grade: Nota }>('/grades', {
    method: 'POST',
    body: JSON.stringify(grade),
  })
  return data.grade
}

export async function updateGrade(id: string, grade: any): Promise<void> {
  await request<void>(`/grades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(grade),
  })
}

export async function deleteGrade(id: string): Promise<void> {
  await request<void>(`/grades/${id}`, {
    method: 'DELETE',
  })
}

// Audit Logs (Logs de Auditoria)
export interface AuditLog {
  id: string
  userId: string
  userName: string
  userRole: string
  action: string
  resource: string
  description: string
  targetId?: string | null
  createdAt: string
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const data = await request<{ logs: AuditLog[] }>('/audit-logs')
  return data.logs || []
}

// PDIs (Plano de Desenvolvimento Individual)
// Usa requestStrict (não request): as rotas vivem sob /students/:id/pdi..., e o fallback de
// request() para caminhos com "students" devolveria um objeto vazio silencioso em erro,
// escondendo mensagens importantes (ex.: limite de anexos, permissão negada).
export interface PdiTrackingSummary {
  area: string
  status: string
  updatedAt: string
  prazo: string | null
}

export interface PdiDashboardItem {
  id: string
  studentId: string
  createdAt: string
  updatedAt: string
  tracking: PdiTrackingSummary[]
  lastEvolutionAt: string | null
  lastUpdateAt: string | null
  lastUpdateLabel: string | null
}

export async function getPdiDashboard(): Promise<PdiDashboardItem[]> {
  const data = await requestStrict<{ pdis: PdiDashboardItem[] }>('/pdis')
  return data.pdis || []
}

export interface StudentPdiDetail {
  pdi: Pdi | null
  tracking: PdiTracking[]
  evolutions: PdiEvolution[]
}

export async function getStudentPdi(studentId: string): Promise<StudentPdiDetail> {
  return requestStrict<StudentPdiDetail>(`/students/${studentId}/pdi`)
}

export async function createStudentPdi(studentId: string, payload: any): Promise<Pdi> {
  const res = await requestStrict<{ pdi: Pdi }>(`/students/${studentId}/pdi`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.pdi
}

export async function updateStudentPdi(studentId: string, payload: any): Promise<Pdi> {
  const res = await requestStrict<{ pdi: Pdi }>(`/students/${studentId}/pdi`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.pdi
}

// Exclusão recuperável: o PDI vai para a lixeira e pode ser restaurado por até 7 dias.
export async function deleteStudentPdi(studentId: string): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/pdi`, {
    method: 'DELETE',
  })
}

export type PdiTrashItem = {
  id: string
  studentId: string
  studentName: string
  deletedAt: string
  deletedByName: string | null
  expiresAt: string
}

// Lista os PDIs na lixeira (excluídos, ainda dentro do prazo de recuperação de 7 dias).
export async function getPdiTrash(): Promise<{ trash: PdiTrashItem[]; ttlDays: number }> {
  return requestStrict<{ trash: PdiTrashItem[]; ttlDays: number }>(`/pdis/trash`)
}

// Restaura da lixeira o PDI de uma criança (desfaz a exclusão).
export async function restoreStudentPdi(studentId: string): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/pdi/restore`, {
    method: 'POST',
  })
}

export async function createPdiEvent(studentId: string, payload: any): Promise<PdiEvent> {
  const res = await requestStrict<{ evento: PdiEvent }>(`/students/${studentId}/pdi/events`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.evento
}

export async function deletePdiEvent(studentId: string, eventId: string): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/pdi/events/${eventId}`, {
    method: 'DELETE',
  })
}

export async function createPdiTracking(studentId: string, payload: any): Promise<PdiTracking> {
  const res = await requestStrict<{ tracking: PdiTracking }>(`/students/${studentId}/pdi/tracking`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.tracking
}

export async function updatePdiTracking(studentId: string, trackingId: string, payload: any): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/pdi/tracking/${trackingId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deletePdiTracking(studentId: string, trackingId: string): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/pdi/tracking/${trackingId}`, {
    method: 'DELETE',
  })
}

export async function getPdiEvolutions(
  studentId: string,
  filters?: { area?: string; startDate?: string; endDate?: string }
): Promise<PdiEvolution[]> {
  const params = new URLSearchParams()
  if (filters?.area) params.set('area', filters.area)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  const query = params.toString() ? `?${params.toString()}` : ''
  const data = await requestStrict<{ evolutions: PdiEvolution[] }>(`/students/${studentId}/pdi/evolutions${query}`)
  return data.evolutions || []
}

export async function createPdiEvolution(studentId: string, payload: any): Promise<PdiEvolution> {
  const res = await requestStrict<{ evolution: PdiEvolution }>(`/students/${studentId}/pdi/evolutions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.evolution
}

export async function deletePdiEvolution(studentId: string, evolutionId: string): Promise<void> {
  await requestStrict<void>(`/students/${studentId}/pdi/evolutions/${evolutionId}`, {
    method: 'DELETE',
  })
}
