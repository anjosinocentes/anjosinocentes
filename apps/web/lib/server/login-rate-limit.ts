import crypto from "crypto"
import { getDb } from "./server-db"

// Rate limit de login para conter brute-force de senha. Conta TENTATIVAS QUE FALHARAM numa janela
// deslizante, por e-mail e por IP. Ao autenticar com sucesso, as tentativas do e-mail são zeradas.
// Tabela `login_attempts` (ver supabase-schema.sql). A limpeza dos registros antigos é feita aqui
// de forma oportunista (o TTL do Mongo não vale no adaptador Postgres).
const MAX_FAILURES_PER_EMAIL = 5
const MAX_FAILURES_PER_IP = 20
const WINDOW_MINUTES = 15

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase()
}

async function cleanupOld(db: any): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)
  await db.collection("login_attempts").deleteMany({ createdAt: { $lt: cutoff } })
}

// true = bloqueado (estourou o limite de falhas na janela).
export async function isLoginBlocked(email: string, ip: string): Promise<boolean> {
  const db = await getDb()
  await cleanupOld(db)
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)
  const [byEmail, byIp] = await Promise.all([
    db.collection("login_attempts").countDocuments({ email: normalizeEmail(email), createdAt: { $gte: since } }),
    db.collection("login_attempts").countDocuments({ ip, createdAt: { $gte: since } }),
  ])
  return byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP
}

export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const db = await getDb()
  await db.collection("login_attempts").insertOne({
    id: crypto.randomUUID(),
    email: normalizeEmail(email),
    ip,
    createdAt: new Date(),
  })
}

// Chamado após login bem-sucedido: limpa as falhas daquele e-mail para não penalizar o usuário
// legítimo que acabou de acertar a senha.
export async function clearLoginAttempts(email: string): Promise<void> {
  const db = await getDb()
  await db.collection("login_attempts").deleteMany({ email: normalizeEmail(email) })
}
