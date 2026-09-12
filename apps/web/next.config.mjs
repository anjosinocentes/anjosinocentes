import path from "path"
import { fileURLToPath } from "url"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Política de Segurança de Conteúdo (CSP): restringe de onde scripts/estilos/etc. podem vir,
// mitigando XSS/clickjacking. É ENDURECIDA em produção e afrouxada só o necessário em dev.
// Usa o PHASE do Next (não process.env.NODE_ENV, que não é confiável na avaliação do config):
//  - PRODUÇÃO: sem 'unsafe-eval' e sem ws/wss (não são usados em runtime). Mantém 'unsafe-inline'
//    porque o App Router do Next injeta scripts inline sem nonce. Origens externas limitadas ao
//    Vercel Analytics (script + beacon), que o app realmente usa.
//  - DESENVOLVIMENTO: adiciona 'unsafe-eval' e ws:/wss:, exigidos pelo Hot Reload (HMR) do Next.
//  - data:/blob: em img/frame são necessários para o visualizador de PDF (iframe data:) e imagens.
function buildSecurityHeaders(isDev) {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), "https://va.vercel-scripts.com"].join(" ")
  const connectSrc = ["'self'", ...(isDev ? ["ws:", "wss:"] : []), "https://va.vercel-scripts.com", "https://*.vercel-insights.com"].join(" ")
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    `connect-src ${connectSrc}`,
    "frame-src 'self' data: blob:",
  ].join("; ")
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ]
}

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  const securityHeaders = buildSecurityHeaders(isDev)
  return {
    typescript: {
      // Erros de tipo DEVEM quebrar o build de produção (não deixar bug de tipo ir para produção).
      ignoreBuildErrors: false,
    },
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders }]
    },
    images: {
      unoptimized: true,
    },
    allowedDevOrigins: ["192.168.56.1"],
    turbopack: {
      root: path.join(__dirname, "..", ".."),
    },
    devIndicators: false,
    async redirects() {
      return [
        { source: "/dashboard/alunos", destination: "/dashboard/criancas", permanent: true },
        { source: "/dashboard/cursos", destination: "/dashboard/oficinas", permanent: true },
      ]
    },
  }
}
