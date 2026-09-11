import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requireAuth, requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { studentSchema, firstZodError } from "@/lib/schemas"

// Lista "enxuta" para quem NÃO tem a permissão de Crianças (ex.: um Professor com só "Presença"):
// apenas o necessário para montar chamadas/turmas (nome, turma, curso, foto). Sem dados sensíveis
// (CPF, endereço, telefone, responsável, e-mail), que ficam restritos a quem tem "alunos".
function toRosterView(doc: any) {
  return {
    id: doc.id,
    nome: doc.nome,
    curso: doc.curso || "",
    fotoUrl: doc.fotoUrl || null,
    classId: doc.classId ?? null,
    class_id: doc.class_id ?? null,
    classIds: doc.classIds ?? [],
    class_ids: doc.class_ids ?? [],
  }
}

// Turmas que este usuário leciona (professorId = id do usuário).
async function getMyClassIds(db: any, userId: string): Promise<Set<string>> {
  const classes = await db
    .collection("classes")
    .find({ $or: [{ professorId: userId }, { professor_id: userId }] })
    .toArray()
  return new Set(classes.map((c: any) => c.id))
}

function studentInClasses(s: any, classIds: Set<string>): boolean {
  if (s.classId && classIds.has(s.classId)) return true
  if (s.class_id && classIds.has(s.class_id)) return true
  const list = Array.isArray(s.classIds) ? s.classIds : Array.isArray(s.class_ids) ? s.class_ids : []
  return list.some((id: string) => classIds.has(id))
}

export async function GET(req: NextRequest) {
  // Três níveis de acesso à lista de crianças, do mais amplo ao mais restrito:
  //  1) ADMIN ou quem tem a permissão "alunos" -> lista COMPLETA com dados sensíveis (CPF, etc.).
  //  2) Demais usuários -> apenas as crianças das TURMAS QUE LECIONAM (professorId = seu id), e
  //     ainda assim só com dados enxutos (nome, turma, curso, foto) para montar a chamada. Não
  //     enxergam a escola inteira - só o seu contexto. Preserva a privacidade dos menores.
  //  3) Quem não leciona nenhuma turma e não tem "alunos" -> lista vazia.
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = (await db.collection("students").find({}).toArray()).map(normalizeDoc)
    const canSeeFull = auth.role === "ADMIN" || !!auth.permissions?.includes(PERMISSIONS.ALUNOS)
    if (canSeeFull) {
      return NextResponse.json({ students: docs })
    }
    const myClassIds = await getMyClassIds(db, auth.id)
    const scoped = docs.filter((s: any) => studentInClasses(s, myClassIds)).map(toRosterView)
    return NextResponse.json({ students: scoped })
  } catch (err: any) {
    return NextResponse.json({ error: "Não foi possível carregar a lista de crianças." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = studentSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data

    const db = await getDb()
    const cpfDigits = (body.cpf || "").replace(/\D/g, "")
    const allCpfs = await db.collection("students").find({}, { projection: { cpf: 1 } }).toArray()
    const isDuplicateCpf = allCpfs.some((s: any) => (s.cpf || "").replace(/\D/g, "") === cpfDigits)
    if (isDuplicateCpf) {
      return NextResponse.json({ error: "Já existe uma criança cadastrada com esse CPF." }, { status: 409 })
    }

    const newId = crypto.randomUUID()
    const newDoc = {
      id: newId,
      nome: body.nome,
      cpf: body.cpf,
      data_nascimento: body.dataNascimento || body.data_nascimento,
      dataNascimento: body.dataNascimento || body.data_nascimento,
      email: body.email || "",
      telefone: body.telefone || "",
      telefoneResponsavel: body.telefoneResponsavel || "",
      endereco: body.endereco || "",
      curso: body.curso || "",
      escola: body.escola || "",
      nomeResponsavel: body.nomeResponsavel || "",
      dataAcolhimento: body.dataAcolhimento || "",
      class_id: body.classId || body.class_id || null,
      class_ids: body.classIds || body.class_ids || [],
      fotoUrl: body.fotoUrl || null,
      created_at: new Date().toISOString(),
    }
    await db.collection("students").insertOne(newDoc)
    return NextResponse.json({ student: normalizeDoc(newDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /students:", err)
    return NextResponse.json({ error: "Não foi possível cadastrar a criança. Tente novamente." }, { status: 500 })
  }
}
