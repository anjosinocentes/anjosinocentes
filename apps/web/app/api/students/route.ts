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

export async function GET(req: NextRequest) {
  // Qualquer usuário autenticado pode obter a LISTA (necessária p/ chamada, turmas, calendário),
  // mas só quem tem a permissão "alunos" (ou o ADMIN) recebe os DADOS SENSÍVEIS completos. Os
  // demais recebem uma lista enxuta (nome + turma), preservando a privacidade das crianças.
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = (await db.collection("students").find({}).toArray()).map(normalizeDoc)
    const canSeeFull = auth.role === "ADMIN" || !!auth.permissions?.includes(PERMISSIONS.ALUNOS)
    const students = canSeeFull ? docs : docs.map(toRosterView)
    return NextResponse.json({ students })
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
