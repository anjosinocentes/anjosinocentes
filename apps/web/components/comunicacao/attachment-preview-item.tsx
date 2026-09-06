"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, FileSpreadsheet, Presentation, FileArchive, ImageOff, Trash2 } from "lucide-react"
import { getAttachmentCategory, getFileExtension, formatFileSize, CATEGORY_LABELS, type AttachmentCategory } from "@/lib/attachment-utils"
import type { AnnouncementAttachment } from "@/lib/types"

const CATEGORY_ICON: Record<AttachmentCategory, typeof FileText> = {
  image: FileText,
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
  other: FileArchive,
}

export function AttachmentPreviewItem({
  attachment,
  onRemove,
}: {
  attachment: AnnouncementAttachment
  onRemove: () => void
}) {
  const [imageError, setImageError] = useState(false)
  const category = getAttachmentCategory(attachment.name, attachment.type)
  const ext = getFileExtension(attachment.name).toUpperCase()

  if (category === "image" && !imageError) {
    return (
      <div className="relative rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
        <img
          src={attachment.data}
          alt={`Pré-visualização de ${attachment.name}`}
          className="w-full max-h-40 object-contain bg-black/5"
          onError={() => setImageError(true)}
        />
        <div className="flex items-center justify-between gap-2 p-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{attachment.name}</p>
            <p className="text-[10px] text-muted-foreground">{formatFileSize(attachment.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
            aria-label={`Remover ${attachment.name}`}
            title="Remover anexo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  const Icon = category === "image" ? ImageOff : CATEGORY_ICON[category]

  return (
    <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-md bg-background border border-border/60 flex items-center justify-center shrink-0 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{attachment.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {category === "image" ? "Não foi possível carregar a imagem" : `${ext || CATEGORY_LABELS[category]} · ${formatFileSize(attachment.size)}`}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
        aria-label={`Remover ${attachment.name}`}
        title="Remover anexo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
