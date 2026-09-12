import { NextResponse } from "next/server"
import { getOwnedClassIds } from "./server-db"
import { isTurmaManager, forbidden, type AuthedUser } from "./server-auth"

// Turmas às quais uma criança pertence (considera nomes antigos/novos dos campos).
export function studentClassIds(student: any): string[] {
  const out: string[] = []
  if (student?.classId) out.push(student.classId)
  if (student?.class_id) out.push(student.class_id)
  for (const id of student?.classIds || []) out.push(id)
  for (const id of student?.class_ids || []) out.push(id)
  return out
}

// ESCOPO POR TURMA (deny-by-default de dados): garante que o usuário só acesse dados de uma criança
// que esteja em uma das SUAS turmas. Gestores de turma (ADMIN ou permissão "turmas" -
// Diretor/Coordenador/Secretário por padrão) enxergam todas as crianças. Um professor só as das
// turmas que leciona - mesmo chamando a API diretamente com outro id. Retorna uma NextResponse de
// erro (404 se a criança não existe, 403 se está fora do escopo) para NEGAR, ou null para liberar.
export async function ensureStudentInScope(db: any, auth: AuthedUser, studentId: string): Promise<NextResponse | null> {
  if (isTurmaManager(auth)) return null
  const student = await db.collection("students").findOne({ id: studentId })
  if (!student) return NextResponse.json({ error: "Criança não encontrada." }, { status: 404 })
  const owned = await getOwnedClassIds(db, auth.id)
  const belongs = studentClassIds(student).some((c) => owned.has(c))
  if (!belongs) return forbidden("Você só tem acesso a crianças das suas turmas.")
  return null
}
