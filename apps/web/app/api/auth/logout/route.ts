import { NextResponse } from "next/server"
import { SESSION_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "@/lib/server/server-auth"

// Encerra a sessão apagando os cookies httpOnly (o cliente não consegue removê-los por JS).
export async function POST() {
  const secure = process.env.NODE_ENV === "production"
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 })
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: REFRESH_COOKIE_PATH, maxAge: 0 })
  return res
}
