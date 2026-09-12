// Validação de anexos no servidor - roda de novo tudo que o cliente já checou (nunca confia
// só no frontend) e adiciona uma camada que o cliente não consegue fazer com segurança:
// conferir a assinatura real (magic bytes) do arquivo, para pegar um executável ou script
// disfarçado de imagem/documento só pela extensão.
import {
  getFileExtension,
  checkAttachmentSet,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
  MAX_LESSON_FILE_BYTES,
  MAX_LESSON_TOTAL_BYTES,
  MAX_LESSON_FILES,
} from "./attachment-utils"

type IncomingAttachment = { name?: string; type?: string; data?: string; size?: number }

// Assinaturas conhecidas por extensão. csv/txt não têm assinatura binária confiável
// (são texto puro), então ficam de fora - continuam protegidos pela lista branca de extensão.
const SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  gif: (b) => b.slice(0, 4).toString("ascii") === "GIF8",
  webp: (b) => b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP",
  pdf: (b) => b.slice(0, 4).toString("ascii") === "%PDF",
  // .docx/.xlsx/.pptx/.zip são contêineres ZIP (assinatura "PK")
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  xlsx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  pptx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  zip: (b) => b[0] === 0x50 && b[1] === 0x4b,
  // .doc/.xls/.ppt (formato binário antigo) são arquivos OLE Compound
  doc: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
  xls: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
  ppt: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
}

function decodeDataUrl(dataUrl: string): Buffer | null {
  // (.*) e não (.+): um base64 vazio é um data: URL válido, só que descreve um arquivo vazio -
  // deixa isso para a checagem de "arquivo vazio" abaixo em vez de cair aqui como "inválido".
  const match = /^data:[^;]+;base64,(.*)$/.exec(dataUrl)
  if (!match) return null
  try {
    return Buffer.from(match[1], "base64")
  } catch {
    return null
  }
}

// Valida cada arquivo individualmente: nome presente, base64 bem-formado, extensão permitida,
// arquivo não-vazio, tamanho real (nunca confia no "size" informado pelo cliente) e assinatura
// binária (magic bytes). Não valida quantidade/total - isso fica a cargo de cada rota, que
// conhece o contexto (ex.: quantos anexos essa criança já tem salvos).
export function validateAttachmentFiles(
  attachments: unknown,
  maxFileSize: number = MAX_FILE_SIZE_BYTES
): { ok: true } | { ok: false; error: string } {
  if (attachments === undefined || attachments === null) return { ok: true }
  if (!Array.isArray(attachments)) return { ok: false, error: "Formato de anexos inválido." }

  const list = attachments as IncomingAttachment[]

  for (const att of list) {
    if (!att.name || typeof att.name !== "string") {
      return { ok: false, error: "Um dos anexos está sem nome de arquivo." }
    }
    if (!att.data || typeof att.data !== "string" || !att.data.startsWith("data:")) {
      return { ok: false, error: `Não foi possível processar o arquivo "${att.name}".` }
    }

    const ext = getFileExtension(att.name)
    if (!(ext in SIGNATURES) && !["csv", "txt"].includes(ext)) {
      return { ok: false, error: `Formato de arquivo não permitido: .${ext || "?"}` }
    }

    const buffer = decodeDataUrl(att.data)
    if (!buffer) {
      return { ok: false, error: `Não foi possível processar o arquivo "${att.name}".` }
    }

    if (buffer.length === 0) {
      return { ok: false, error: `O arquivo "${att.name}" está vazio.` }
    }

    // O tamanho declarado pelo cliente não é confiável - confere o tamanho real dos bytes.
    if (buffer.length > maxFileSize) {
      return {
        ok: false,
        error: `O arquivo "${att.name}" excede o tamanho máximo permitido (${formatFileSize(maxFileSize)}).`,
      }
    }

    const signatureCheck = SIGNATURES[ext]
    if (signatureCheck && !signatureCheck(buffer)) {
      return {
        ok: false,
        error: `O arquivo "${att.name}" não parece ser um arquivo .${ext} válido.`,
      }
    }
  }

  return { ok: true }
}

// Usado pelo mural de Comunicação: o array inteiro de anexos é reenviado a cada criação/edição
// do comunicado, então aqui também valida quantidade e tamanho total combinado.
export function validateAttachmentsServerSide(attachments: unknown): { ok: true } | { ok: false; error: string } {
  if (attachments === undefined || attachments === null) return { ok: true }
  if (!Array.isArray(attachments)) return { ok: false, error: "Formato de anexos inválido." }

  const list = attachments as IncomingAttachment[]

  const countCheck = checkAttachmentSet(list.map((a) => ({ name: a.name || "", size: a.size || 0 })))
  if (!countCheck.ok) return { ok: false, error: countCheck.reason }

  return validateAttachmentFiles(list)
}

// Materiais de AULA: valida cada arquivo (tipo real via magic bytes + limite por arquivo de 3 MB)
// e o total combinado + quantidade. Rodado no servidor (nunca confiar só no cliente), evitando que
// um Word/PDF grande embutido em base64 estoure o limite de corpo da requisição e "quebre" o salvamento.
export function validateLessonFiles(files: unknown): { ok: true } | { ok: false; error: string } {
  if (files === undefined || files === null) return { ok: true }
  if (!Array.isArray(files)) return { ok: false, error: "Formato de materiais inválido." }
  if (files.length > MAX_LESSON_FILES) {
    return { ok: false, error: `Máximo de ${MAX_LESSON_FILES} materiais por aula.` }
  }
  const perFile = validateAttachmentFiles(files, MAX_LESSON_FILE_BYTES)
  if (!perFile.ok) return perFile

  let total = 0
  for (const f of files as IncomingAttachment[]) {
    const buf = f.data ? decodeDataUrl(f.data) : null
    if (buf) total += buf.length
  }
  if (total > MAX_LESSON_TOTAL_BYTES) {
    return { ok: false, error: `O total dos materiais excede ${formatFileSize(MAX_LESSON_TOTAL_BYTES)}. Remova algum arquivo ou compartilhe por link.` }
  }
  return { ok: true }
}
