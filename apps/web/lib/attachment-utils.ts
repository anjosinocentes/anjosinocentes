// Regras de anexos do mural de Comunicação - usado tanto no formulário (preview/validação
// no cliente) quanto na API (nunca confiar só na validação do frontend).
export type AttachmentCategory = "image" | "pdf" | "word" | "excel" | "powerpoint" | "other"

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB por arquivo (limite já existente, mantido)
export const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB somando todos os anexos de um comunicado
export const MAX_FILES_PER_ANNOUNCEMENT = 10

// Anexos de crianças: cada arquivo vira um documento próprio no banco (não um array embutido
// num único documento), então não há necessidade de limite de tamanho total combinado - só
// por arquivo e por quantidade.
export const MAX_STUDENT_ATTACHMENTS = 5
export const MAX_STUDENT_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024 // 10 MB por arquivo

type ExtensionConfig = {
  category: AttachmentCategory
  mimeTypes: string[]
}

// Lista branca de extensões permitidas. Qualquer extensão fora daqui é sempre recusada,
// mesmo que o navegador informe um MIME type que pareça inofensivo - evita arquivos
// perigosos disfarçados só pela extensão/nome.
const EXTENSION_MAP: Record<string, ExtensionConfig> = {
  jpg: { category: "image", mimeTypes: ["image/jpeg"] },
  jpeg: { category: "image", mimeTypes: ["image/jpeg"] },
  png: { category: "image", mimeTypes: ["image/png"] },
  webp: { category: "image", mimeTypes: ["image/webp"] },
  gif: { category: "image", mimeTypes: ["image/gif"] },
  pdf: { category: "pdf", mimeTypes: ["application/pdf"] },
  doc: { category: "word", mimeTypes: ["application/msword"] },
  docx: {
    category: "word",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  xls: { category: "excel", mimeTypes: ["application/vnd.ms-excel"] },
  xlsx: {
    category: "excel",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  ppt: { category: "powerpoint", mimeTypes: ["application/vnd.ms-powerpoint"] },
  pptx: {
    category: "powerpoint",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  },
  zip: { category: "other", mimeTypes: ["application/zip", "application/x-zip-compressed"] },
  csv: { category: "other", mimeTypes: ["text/csv", "application/vnd.ms-excel"] },
  txt: { category: "other", mimeTypes: ["text/plain"] },
}

export const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  image: "Imagem",
  pdf: "PDF",
  word: "Word",
  excel: "Excel",
  powerpoint: "PowerPoint",
  other: "Arquivo",
}

export function getFileExtension(filename: string): string {
  const parts = (filename || "").trim().toLowerCase().split(".")
  return parts.length > 1 ? parts[parts.length - 1] : ""
}

// Determina a categoria pela extensão (fonte confiável para decidir COMO exibir o anexo).
// O MIME type é usado só como checagem adicional de plausibilidade em isAllowedFile().
export function getAttachmentCategory(filename: string, mimeType?: string): AttachmentCategory {
  const ext = getFileExtension(filename)
  if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext].category
  if (mimeType?.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  return "other"
}

export type FileCheckResult = { ok: true } | { ok: false; reason: string }

// Validação de um único arquivo: extensão permitida + MIME plausível para essa extensão
// (quando o navegador informa um) + tamanho. Mesma função usada no formulário de criação.
// maxFileSize é parametrizável porque diferentes recursos (comunicados, anexos de criança)
// têm limites por arquivo diferentes.
export function checkFile(
  filename: string,
  mimeType: string,
  size: number,
  maxFileSize: number = MAX_FILE_SIZE_BYTES
): FileCheckResult {
  const ext = getFileExtension(filename)
  const config = EXTENSION_MAP[ext]

  if (!config) {
    return { ok: false, reason: `Formato de arquivo não permitido: .${ext || "?"}` }
  }

  if (mimeType && !config.mimeTypes.includes(mimeType)) {
    return { ok: false, reason: `O conteúdo do arquivo "${filename}" não corresponde à extensão .${ext}.` }
  }

  if (size > maxFileSize) {
    return {
      ok: false,
      reason: `O arquivo "${filename}" é muito grande. O tamanho máximo permitido é de ${formatFileSize(maxFileSize)}.`,
    }
  }

  return { ok: true }
}

// Validação do conjunto de anexos de um comunicado: quantidade e tamanho total combinado
// (o documento inteiro é salvo em uma única entrada no banco, então o total importa).
export function checkAttachmentSet(files: { name: string; size: number }[]): FileCheckResult {
  if (files.length > MAX_FILES_PER_ANNOUNCEMENT) {
    return { ok: false, reason: `Você pode anexar no máximo ${MAX_FILES_PER_ANNOUNCEMENT} arquivos por comunicado.` }
  }
  const total = files.reduce((sum, f) => sum + f.size, 0)
  if (total > MAX_TOTAL_SIZE_BYTES) {
    return {
      ok: false,
      reason: `O total dos anexos não pode ultrapassar ${formatFileSize(MAX_TOTAL_SIZE_BYTES)}. Remova algum arquivo.`,
    }
  }
  return { ok: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const ACCEPT_ATTRIBUTE = Object.keys(EXTENSION_MAP)
  .map((ext) => `.${ext}`)
  .join(",")
