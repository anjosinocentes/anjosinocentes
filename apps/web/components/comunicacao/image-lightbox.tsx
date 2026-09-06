"use client"

import { useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react"
import type { AnnouncementAttachment } from "@/lib/types"

export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: AnnouncementAttachment[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const open = index !== null
  const current = index !== null ? images[index] : null

  const goPrev = useCallback(() => {
    if (index === null) return
    onIndexChange((index - 1 + images.length) % images.length)
  }, [index, images.length, onIndexChange])

  const goNext = useCallback(() => {
    if (index === null) return
    onIndexChange((index + 1) % images.length)
  }, [index, images.length, onIndexChange])

  // Navegação por teclado (setas) - o Dialog já fecha com ESC e tem foco preso nele por padrão.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, goPrev, goNext])

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton
        className="max-w-4xl w-[95vw] bg-background border border-border p-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">{current.name}</DialogTitle>
        <div className="relative flex flex-col">
          <div className="relative flex items-center justify-center bg-black/90 min-h-[50vh] max-h-[75vh]">
            {images.length > 1 && (
              <button
                type="button"
                onClick={goPrev}
                aria-label="Imagem anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <img
              src={current.data}
              alt={current.name}
              className="max-w-full max-h-[75vh] object-contain"
            />
            {images.length > 1 && (
              <button
                type="button"
                onClick={goNext}
                aria-label="Próxima imagem"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 border-t border-border bg-card">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{current.name}</p>
              {images.length > 1 && (
                <p className="text-[10px] text-muted-foreground" aria-live="polite">
                  {index !== null ? index + 1 : 0} / {images.length}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Abrir em nova aba">
                <a href={current.data} target="_blank" rel="noreferrer" aria-label="Abrir imagem em nova aba">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8" title="Baixar imagem">
                <a href={current.data} download={current.name} aria-label={`Baixar ${current.name}`}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Baixar
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
