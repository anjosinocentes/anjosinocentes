"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { FileText, FileSpreadsheet, Presentation, FileArchive, ImageIcon, Download, Eye, Trash2, Clock } from "lucide-react"
import { getAttachmentCategory, getFileExtension, formatFileSize, CATEGORY_LABELS, type AttachmentCategory } from "@/lib/attachment-utils"

const CATEGORY_ICON: Record<AttachmentCategory, typeof FileText> = {
  image: ImageIcon,
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

export type AttachmentRowItem = {
  id: string
  name: string
  type: string
  size: number
  data: string
  createdAt?: string
}

export function StudentAttachmentRow({
  attachment,
  pending = false,
  onDelete,
}: {
  attachment: AttachmentRowItem
  pending?: boolean
  onDelete: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const category = getAttachmentCategory(attachment.name, attachment.type)
  const Icon = CATEGORY_ICON[category]
  const ext = getFileExtension(attachment.name).toUpperCase()
  const canPreview = category === "image" || category === "pdf"

  return (
    <>
      <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center gap-3">
        {category === "image" ? (
          <img
            src={attachment.data}
            alt={attachment.name}
            className="h-9 w-9 rounded-md object-cover border border-border/60 shrink-0"
          />
        ) : (
          <div className={`h-9 w-9 rounded-md bg-background border border-border/60 flex items-center justify-center shrink-0 ${CATEGORY_ICON_COLOR[category]}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate" title={attachment.name}>
            {attachment.name}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{ext || CATEGORY_LABELS[category]} · {formatFileSize(attachment.size)}</span>
            {pending ? (
              <span className="inline-flex items-center gap-1 text-primary font-medium">
                <Clock className="h-3 w-3" />
                Será salvo ao cadastrar
              </span>
            ) : attachment.createdAt ? (
              <span>{new Date(attachment.createdAt).toLocaleDateString("pt-BR")}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canPreview && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setPreviewOpen(true)}
              title="Visualizar arquivo"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Baixar arquivo">
            <a href={attachment.data} download={attachment.name} aria-label={`Baixar ${attachment.name}`}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Excluir anexo"
            aria-label={`Excluir ${attachment.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {canPreview && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl w-[95vw] h-[85vh] bg-background border border-border p-0 overflow-hidden flex flex-col">
            <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
            <div className="flex items-center justify-between gap-3 p-3 border-b border-border shrink-0">
              <p className="text-sm font-medium text-foreground truncate pr-8">{attachment.name}</p>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs shrink-0">
                <a href={attachment.data} download={attachment.name}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Baixar
                </a>
              </Button>
            </div>
            {category === "image" ? (
              <div className="flex-1 flex items-center justify-center overflow-auto bg-black/5 p-4">
                <img src={attachment.data} alt={attachment.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <iframe src={attachment.data} title={`Visualização de ${attachment.name}`} className="w-full flex-1 border-0" />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
