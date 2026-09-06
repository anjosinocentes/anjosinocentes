import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Política de Segurança de Conteúdo (CSP): restringe de onde scripts/estilos/etc. podem vir,
// mitigando XSS/clickjacking. Precisa permitir:
//  - 'unsafe-inline'/'unsafe-eval' em scripts: o Next (App Router, sem nonce) e o HMR usam;
//  - data:/blob: em img e frame: usados pelo visualizador de PDF (iframe data:) e imagens;
//  - ws:/wss: em connect: o Hot Reload do Next no desenvolvimento.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // va.vercel-scripts.com: script do Vercel Analytics (@vercel/analytics), usado no app.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  // vercel-insights: beacon do Analytics. ws/wss: Hot Reload do Next no desenvolvimento.
  "connect-src 'self' ws: wss: https://va.vercel-scripts.com https://*.vercel-insights.com",
  "frame-src 'self' data: blob:",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
      {
        source: "/dashboard/alunos",
        destination: "/dashboard/criancas",
        permanent: true,
      },
      {
        source: "/dashboard/cursos",
        destination: "/dashboard/oficinas",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
