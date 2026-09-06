"use client"

import { useMemo, useState } from "react"
import { Paperclip } from "lucide-react"
import { getAttachmentCategory } from "@/lib/attachment-utils"
import type { AnnouncementAttachment } from "@/lib/types"
import { ImageLightbox } from "./image-lightbox"
import { DocumentCard } from "./document-card"

export function AttachmentDisplay({ attachments }: { attachments: AnnouncementAttachment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { images, documents } = useMemo(() => {
    const images: AnnouncementAttachment[] = []
    const documents: AnnouncementAttachment[] = []
    for (const att of attachments) {
      if (getAttachmentCategory(att.name, att.type) === "image") images.push(att)
      else documents.push(att)
    }
    return { images, documents }
  }, [attachments])

  if (images.length === 0 && documents.length === 0) return null

  return (
    <div className="space-y-3">
      {images.length === 1 && (
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="block w-full rounded-lg overflow-hidden border border-border/60 bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={images[0].data}
            alt={images[0].name}
            className="w-full max-h-96 object-contain mx-auto"
          />
        </button>
      )}

      {images.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* object-cover recorta para preencher a miniatura sem distorcer (a imagem
                  inteira, sem corte, aparece ao abrir no visualizador ampliado). */}
              <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-2">
          {images.length > 0 && (
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              Documentos anexados
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {documents.map((doc, idx) => (
              <DocumentCard key={idx} attachment={doc} />
            ))}
          </div>
        </div>
      )}

      <ImageLightbox
        images={images}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  )
}
