// Compressão de imagens no navegador (canvas) antes de enviar ao servidor.
// Evita gravar fotos gigantes no banco: reduz dimensão e reencoda como JPEG
// com qualidade decrescente até caber num tamanho razoável.

const MAX_DIMENSION = 1280
const TARGET_BYTES = 2 * 1024 * 1024 // meta: ~2MB após compressão
const HARD_CAP_BYTES = 3 * 1024 * 1024 // nunca ultrapassar ~3MB
const MIN_QUALITY = 0.4

export type CompressImageOptions = {
  maxDimension?: number
  targetBytes?: number
  hardCapBytes?: number
  minQuality?: number
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem"))
    img.src = src
  })
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const padding = (base64.match(/=+$/) || [""])[0].length
  return Math.round((base64.length * 3) / 4) - padding
}

function fitDimensions(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) return { width, height }
  const scale = maxDim / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function compressImageFile(file: File, options?: CompressImageOptions): Promise<string> {
  const maxDimension = options?.maxDimension ?? MAX_DIMENSION
  const targetBytes = options?.targetBytes ?? TARGET_BYTES
  const hardCapBytes = options?.hardCapBytes ?? HARD_CAP_BYTES
  const minQuality = options?.minQuality ?? MIN_QUALITY

  const originalDataUrl = await readFileAsDataURL(file)
  const img = await loadImage(originalDataUrl)
  const naturalW = img.naturalWidth || 1
  const naturalH = img.naturalHeight || 1

  // Imagem já otimizada (tamanho e dimensão adequados): preserva o arquivo original em vez
  // de reencodar à toa - reencodar pode até aumentar o tamanho de um PNG/JPEG já comprimido.
  if (file.size <= targetBytes && naturalW <= maxDimension && naturalH <= maxDimension) {
    return originalDataUrl
  }

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return originalDataUrl

  const render = (maxDim: number, quality: number) => {
    const { width, height } = fitDimensions(naturalW, naturalH, maxDim)
    canvas.width = width
    canvas.height = height
    // fundo branco: PNGs com transparência não devem virar preto ao virar JPEG
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL("image/jpeg", quality)
  }

  let maxDim = maxDimension
  let quality = 0.85
  let result = render(maxDim, quality)

  while (estimateDataUrlBytes(result) > targetBytes && quality > minQuality) {
    quality -= 0.1
    result = render(maxDim, quality)
  }

  // Se mesmo na qualidade mínima ainda estiver grande demais, reduz a dimensão também
  while (estimateDataUrlBytes(result) > hardCapBytes && maxDim > 320) {
    maxDim = Math.round(maxDim * 0.8)
    result = render(maxDim, Math.max(quality, minQuality))
  }

  // Reencodar só compensa se realmente encolheu o arquivo - do contrário, mantém o original.
  return estimateDataUrlBytes(result) < file.size ? result : originalDataUrl
}
