import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import bcrypt from "bcryptjs"
import { requireTeamAdmin } from "@/lib/server/server-auth"
import { getPasswordValidationError } from "@/lib/password-policy"

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireTeamAdmin(req)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const { password } = await req.json()
    const pwError = getPasswordValidationError(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const db = await getDb()
    const filter = { id }
    const target = await db.collection("users").findOne(filter)
    await db.collection("users").updateOne(filter, { $set: { passwordHash }, $unset: { password: "" } })
    await logAudit(req, "RESET_PASSWORD", "user", `Redefiniu a senha do colaborador ${target?.name ?? id}`, id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
