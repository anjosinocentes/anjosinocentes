import { z } from "zod"
import { isValidCPF, isValidEmailFormat } from "./validators"
import { MAX_STUDENT_ATTACHMENTS } from "./attachment-utils"
import { MAX_PDI_EVOLUTION_ATTACHMENTS } from "./pdi-constants"

// Schemas de validação server-side por recurso. Nunca confiar só na validação do
// frontend - o cliente pode ser burlado com uma chamada direta à API.
//
// Limites de tamanho escolhidos pelo significado de cada campo (não um valor único pra
// tudo): nome de pessoa é mais curto que uma mensagem de aviso, por exemplo.

const trimmedString = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} é obrigatório` })
    .trim()
    .min(min, `${label} deve ter pelo menos ${min} caractere${min > 1 ? "s" : ""}`)
    .max(max, `${label} deve ter no máximo ${max} caracteres`)

const optionalTrimmedString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} deve ter no máximo ${max} caracteres`)
    .optional()
    .or(z.literal(""))

export const studentSchema = z.object({
  nome: trimmedString(2, 150, "Nome"),
  cpf: z
    .string({ required_error: "CPF é obrigatório" })
    .refine((v) => isValidCPF(v), "CPF inválido"),
  dataNascimento: z.string().trim().min(1, "Data de nascimento é obrigatória").optional(),
  data_nascimento: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidEmailFormat(v), "E-mail inválido")
    .optional()
    .or(z.literal("")),
  telefone: optionalTrimmedString(20, "Telefone"),
  telefoneResponsavel: trimmedString(8, 20, "Telefone do responsável"),
  endereco: optionalTrimmedString(300, "Endereço"),
  curso: optionalTrimmedString(150, "Oficina"),
  escola: optionalTrimmedString(150, "Escola"),
  nomeResponsavel: optionalTrimmedString(150, "Nome do responsável"),
  dataAcolhimento: z.string().trim().optional().or(z.literal("")),
  classId: z.string().nullable().optional(),
  class_id: z.string().nullable().optional(),
  classIds: z.array(z.string()).max(50).optional(),
  class_ids: z.array(z.string()).max(50).optional(),
  fotoUrl: z
    .string()
    .max(4_500_000, "A foto é muito grande")
    .refine((v) => v === "" || v.startsWith("data:image/"), "Foto inválida")
    .optional()
    .or(z.literal("")),
}).passthrough()

export const studentUpdateSchema = studentSchema.partial()

// Payload de upload de anexos: só a forma dos dados. Extensão/MIME/assinatura binária/tamanho
// real e limite de quantidade (considerando o que a criança já tem salvo) ficam a cargo de
// attachment-validation.ts e da própria rota, que conhece o contexto.
export const studentAttachmentUploadSchema = z.object({
  attachments: z
    .array(
      z.object({
        name: trimmedString(1, 255, "Nome do arquivo"),
        type: z.string().max(200).optional().default(""),
        data: z.string().min(1, "Arquivo inválido"),
        size: z.coerce.number().nonnegative().optional().default(0),
      })
    )
    .min(1, "Selecione ao menos um arquivo")
    .max(MAX_STUDENT_ATTACHMENTS, `Você pode anexar no máximo ${MAX_STUDENT_ATTACHMENTS} arquivos por vez`),
})

export const classSchema = z.object({
  nome: trimmedString(2, 150, "Nome da turma"),
  sala: optionalTrimmedString(100, "Sala"),
  capacidade: z.coerce.number().int().min(1, "Capacidade deve ser maior que zero").max(500, "Capacidade máxima é 500"),
}).passthrough()

export const classUpdateSchema = z.object({
  nome: trimmedString(2, 150, "Nome da turma").optional(),
  sala: optionalTrimmedString(100, "Sala"),
  capacidade: z.coerce.number().int().min(1, "Capacidade deve ser maior que zero").max(500, "Capacidade máxima é 500").optional(),
}).passthrough()

export const courseSchema = z.object({
  name: trimmedString(2, 150, "Nome da oficina"),
  description: optionalTrimmedString(1000, "Descrição"),
}).passthrough()

export const courseUpdateSchema = courseSchema.partial()

export const eventSchema = z.object({
  titulo: trimmedString(2, 200, "Título"),
  descricao: optionalTrimmedString(2000, "Descrição"),
  data: z.string({ required_error: "Data é obrigatória" }).trim().min(1, "Data é obrigatória"),
  horario: optionalTrimmedString(20, "Horário"),
  tipo: z.enum(["aula", "evento", "reuniao", "feriado"]).optional(),
}).passthrough()

export const eventUpdateSchema = z.object({
  titulo: trimmedString(2, 200, "Título").optional(),
  descricao: optionalTrimmedString(2000, "Descrição"),
  data: z.string().trim().min(1).optional(),
  horario: optionalTrimmedString(20, "Horário"),
  tipo: z.enum(["aula", "evento", "reuniao", "feriado"]).optional(),
}).passthrough()

export const lessonSchema = z.object({
  data: z.string({ required_error: "Data é obrigatória" }).trim().min(1, "Data é obrigatória"),
  turma: optionalTrimmedString(150, "Turma"),
  disciplina: optionalTrimmedString(150, "Disciplina"),
  conteudo: trimmedString(2, 5000, "O que foi trabalhado"),
  observacoes: optionalTrimmedString(2000, "Comentários"),
}).passthrough()

export const lessonUpdateSchema = z.object({
  data: z.string().trim().min(1).optional(),
  turma: optionalTrimmedString(150, "Turma"),
  disciplina: optionalTrimmedString(150, "Disciplina"),
  conteudo: trimmedString(2, 5000, "O que foi trabalhado").optional(),
  observacoes: optionalTrimmedString(2000, "Comentários"),
}).passthrough()

export const announcementSchema = z.object({
  title: trimmedString(2, 200, "Título"),
  body: trimmedString(2, 5000, "Mensagem"),
  tipo: z.enum(["informativo", "importante", "urgente"]).optional(),
}).passthrough()

export const announcementUpdateSchema = z.object({
  title: trimmedString(2, 200, "Título").optional(),
  body: trimmedString(2, 5000, "Mensagem").optional(),
  tipo: z.enum(["informativo", "importante", "urgente"]).optional(),
}).passthrough()

export const teacherSchema = z.object({
  name: trimmedString(2, 150, "Nome"),
  email: z.string({ required_error: "E-mail é obrigatório" }).trim().refine(isValidEmailFormat, "E-mail inválido"),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "DIRECTOR", "COORDINATOR", "SECRETARY", "TEACHER"]).optional(),
}).passthrough()

export const teacherUpdateSchema = z.object({
  name: trimmedString(2, 150, "Nome").optional(),
  email: z.string().trim().refine(isValidEmailFormat, "E-mail inválido").optional(),
  role: z.enum(["ADMIN", "DIRECTOR", "COORDINATOR", "SECRETARY", "TEACHER"]).optional(),
}).passthrough()

export const attendanceRecordSchema = z.object({
  studentId: z.string().optional(),
  alunoId: z.string().optional(),
  status: z.string().min(1).max(20),
})

export const attendanceBulkSchema = z.object({
  date: z.string({ required_error: "Data é obrigatória" }).trim().min(1, "Data é obrigatória"),
  classId: z.string().optional().nullable(),
  records: z.array(attendanceRecordSchema).max(500, "Número de registros de presença excede o limite"),
})

// PDI (Plano de Desenvolvimento Individual) - área/status não usam z.enum porque a lista fixa
// vive em lib/pdi-constants.ts; a rota confere se a chave existe lá (evita duplicar a lista aqui
// e ter que lembrar de atualizar os dois lugares ao adicionar uma área/status novo).
const pdiAttachmentSchema = z.object({
  name: trimmedString(1, 255, "Nome do arquivo"),
  type: z.string().max(200).optional().default(""),
  data: z.string().min(1, "Arquivo inválido"),
  size: z.coerce.number().nonnegative().optional().default(0),
})

export const pdiInitialSchema = z.object({
  situacaoInicial: trimmedString(2, 3000, "Situação inicial"),
  objetivosIniciais: optionalTrimmedString(2000, "Objetivos iniciais"),
  observacoesIniciais: optionalTrimmedString(3000, "Observações"),
  areas: z.array(z.string()).max(20).optional().default([]),
  attachments: z
    .array(pdiAttachmentSchema)
    .max(MAX_PDI_EVOLUTION_ATTACHMENTS, `Você pode anexar no máximo ${MAX_PDI_EVOLUTION_ATTACHMENTS} arquivos`)
    .optional(),
}).passthrough()

export const pdiTrackingSchema = z.object({
  area: trimmedString(1, 50, "Área"),
  objetivo: trimmedString(2, 300, "Objetivo"),
  descricao: optionalTrimmedString(2000, "Descrição"),
  dataInicio: z.string({ required_error: "Data de início é obrigatória" }).trim().min(1, "Data de início é obrigatória"),
  prazo: z.string().trim().optional().or(z.literal("")),
  status: trimmedString(1, 50, "Status"),
  observacoes: optionalTrimmedString(2000, "Observações"),
}).passthrough()

export const pdiTrackingUpdateSchema = pdiTrackingSchema.partial()

// Edição do histórico inicial do PDI (situação/objetivos/observações) depois de criado -
// mesmos campos de pdiInitialSchema, exceto áreas/anexos (não fazem sentido re-editar aqui).
export const pdiUpdateSchema = z.object({
  situacaoInicial: trimmedString(2, 3000, "Situação inicial"),
  objetivosIniciais: optionalTrimmedString(2000, "Objetivos iniciais"),
  observacoesIniciais: optionalTrimmedString(3000, "Observações"),
}).partial().passthrough()

// Marco geral da linha do tempo (ex.: "Visita domiciliar") - não pertence a uma área
// acompanhada, por isso vive separado de pdiTrackingSchema/pdiEvolutionSchema.
export const pdiEventSchema = z.object({
  data: z.string({ required_error: "Data é obrigatória" }).trim().min(1, "Data é obrigatória"),
  titulo: trimmedString(2, 150, "Título"),
  descricao: optionalTrimmedString(2000, "Descrição"),
}).passthrough()

export const pdiEvolutionSchema = z.object({
  area: trimmedString(1, 50, "Área"),
  status: trimmedString(1, 50, "Status"),
  data: z.string({ required_error: "Data é obrigatória" }).trim().min(1, "Data é obrigatória"),
  relato: trimmedString(2, 5000, "Registro"),
  proximosPassos: optionalTrimmedString(2000, "Próximos passos"),
  attachments: z
    .array(pdiAttachmentSchema)
    .max(MAX_PDI_EVOLUTION_ATTACHMENTS, `Você pode anexar no máximo ${MAX_PDI_EVOLUTION_ATTACHMENTS} arquivos por registro`)
    .optional(),
}).passthrough()

export function firstZodError(error: z.ZodError): string {
  return error.errors[0]?.message || "Dados inválidos"
}
