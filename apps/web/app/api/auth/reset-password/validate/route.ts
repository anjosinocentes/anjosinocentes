import { NextRequest, NextResponse } from "next/server"
import { checkResetToken } from "@/lib/server/password-reset"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || ""

  try {
    const { status } = await checkResetToken(token)
    return NextResponse.json({ valid: status === "valid", reason: status === "valid" ? null : status })
  } catch (err) {
    console.error("Erro em /auth/reset-password/validate:", err)
    return NextResponse.json({ valid: false, reason: "invalid" })
  }
}
