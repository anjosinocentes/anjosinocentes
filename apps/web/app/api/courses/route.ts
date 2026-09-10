import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requirePermission, requireAuth } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { courseSchema, firstZodError } from "@/lib/schemas"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db.collection("courses").find({}).toArray()
    const courses = docs.map(normalizeDoc)
    return NextResponse.json({ courses })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.OFICINAS)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = courseSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDb()

    const allCourses = await db.collection("courses").find({}, { projection: { name: 1 } }).toArray()
    const normalizedName = parsed.data.name.trim().toLowerCase()
    const isDuplicate = allCourses.some((c: any) => (c.name || "").trim().toLowerCase() === normalizedName)
    if (isDuplicate) {
      return NextResponse.json({ error: "Já existe uma oficina cadastrada com esse nome." }, { status: 409 })
    }

    const newId = crypto.randomUUID()
    const newDoc = { id: newId, ...parsed.data, created_at: new Date().toISOString() }
    await db.collection("courses").insertOne(newDoc)
    return NextResponse.json({ course: normalizeDoc(newDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /courses:", err)
    return NextResponse.json({ error: "Não foi possível criar a oficina. Tente novamente." }, { status: 500 })
  }
}
