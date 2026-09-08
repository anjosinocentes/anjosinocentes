import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requirePermission, requireRole } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { studentSchema, firstZodError } from "@/lib/schemas"

export async function GET(req: NextRequest) {
  // Dados sensíveis de crianças (CPF, endereço, telefone): exige a permissão "alunos",
  // não apenas estar autenticado. ADMIN/DIRECTOR sempre passam.
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db.collection("students").find({}).toArray()
    const students = docs.map(normalizeDoc)
    return NextResponse.json({ students })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "SECRETARY")
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
