"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { FileText, FileSpreadsheet, Presentation, FileArchive, Download, Eye } from "lucide-react"
import { getAttachmentCategory, getFileExtension, formatFileSize, CATEGORY_LABELS, type AttachmentCategory } from "@/lib/attachment-utils"
import type { AnnouncementAttachment } from "@/lib/types"

const CATEGORY_ICON: Record<AttachmentCategory, typeof FileText> = {
  image: FileText, // não usado (imagens não passam por este componente)
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
  other: FileArchive,
}

const CATEGORY_ICON_COLOR: Record<AttachmentCategory, string> = {
  image: "text-primary",
  pdf: "text-destructive",
  word: "text-blue-500",
  excel: "text-green-600",
  powerpoint: "text-orange-500",
  other: "text-muted-foreground",
}

export function DocumentCard({ attachment }: { attachment: AnnouncementAttachment }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const category = getAttachmentCategory(attachment.name, attachment.type)
  const Icon = CATEGORY_ICON[category]
  const ext = getFileExtension(attachment.name).toUpperCase()

  return (
    <>
      <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md bg-background border border-border/60 flex items-center justify-center shrink-0 ${CATEGORY_ICON_COLOR[category]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate" title={attachment.name}>
            {attachment.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {ext || CATEGORY_LABELS[category]} · {formatFileSize(attachment.size)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {category === "pdf" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Visualizar
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <a href={attachment.data} download={attachment.name} aria-label={`Baixar ${attachment.name}`}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Baixar
            </a>
          </Button>
        </div>
      </div>

      {category === "pdf" && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl w-[95vw] h-[85vh] bg-background border border-border p-0 overflow-hidden flex flex-col">
            <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
            <div className="flex items-center justify-between gap-3 p-3 pr-12 border-b border-border shrink-0">
              <p className="text-sm font-medium text-foreground truncate">{attachment.name}</p>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs shrink-0">
                <a href={attachment.data} download={attachment.name}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Baixar
                </a>
              </Button>
            </div>
            <iframe
              src={attachment.data}
              title={`Visualização de ${attachment.name}`}
              className="w-full flex-1 border-0"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
