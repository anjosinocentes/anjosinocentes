"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, Paperclip, X, FileText, FileSpreadsheet, Presentation, FileArchive, ImageIcon } from "lucide-react"
import { PDI_AREAS, PDI_STATUSES, MAX_PDI_EVOLUTION_ATTACHMENTS, MAX_PDI_EVOLUTION_ATTACHMENT_BYTES } from "@/lib/pdi-constants"
import { checkFile, getAttachmentCategory, ACCEPT_ATTRIBUTE, formatFileSize, type AttachmentCategory } from "@/lib/attachment-utils"
import { compressImageFile, readFileAsDataURL } from "@/lib/image"
import { createPdiEvolution } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-provider"
import type { PdiEvolution } from "@/lib/types"
import { toast } from "sonner"

const CATEGORY_ICON: Record<AttachmentCategory, typeof FileText> = {
  image: ImageIcon,
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
  other: FileArchive,
}

type PendingFile = { name: string; type: string; data: string; size: number }

function getLocalDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function RegisterEvolutionDialog({
  studentId,
  defaultArea,
  onCreated,
}: {
  studentId: string
  defaultArea?: string
  onCreated: (evolution: PdiEvolution) => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [processingFile, setProcessingFile] = useState(false)
  const [fileError, setFileError] = useState("")

  const [area, setArea] = useState(defaultArea || PDI_AREAS[0].key)
  const [data, setData] = useState(getLocalDateString())
  const [status, setStatus] = useState<string>(PDI_STATUSES[1].key)
  const [relato, setRelato] = useState("")
  const [proximosPassos, setProximosPassos] = useState("")
  const [attachments, setAttachments] = useState<PendingFile[]>([])

  const resetForm = () => {
    setArea(defaultArea || PDI_AREAS[0].key)
    setData(getLocalDateString())
    setStatus(PDI_STATUSES[1].key)
    setRelato("")
    setProximosPassos("")
    setAttachments([])
    setFileError("")
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setFileError("")

    const remaining = MAX_PDI_EVOLUTION_ATTACHMENTS - attachments.length
    if (remaining <= 0) {
      setFileError(`Você pode anexar no máximo ${MAX_PDI_EVOLUTION_ATTACHMENTS} arquivos por registro.`)
      return
    }
    if (files.length > remaining) {
      setFileError(`Só é possível adicionar mais ${remaining} arquivo${remaining === 1 ? "" : "s"} neste registro.`)
      return
    }

    setProcessingFile(true)
    const prepared: PendingFile[] = []
    const errors: string[] = []

    for (const file of files) {
      if (file.size === 0) {
        errors.push(`O arquivo "${file.name}" está vazio.`)
        continue
      }
      const check = checkFile(file.name, file.type, file.size, MAX_PDI_EVOLUTION_ATTACHMENT_BYTES)
      if (!check.ok) {
        errors.push(check.reason)
        continue
      }
      try {
        const category = getAttachmentCategory(file.name, file.type)
        const dataUrl =
          category === "image"
            ? await compressImageFile(file, { maxDimension: 1600, targetBytes: 1.2 * 1024 * 1024, hardCapBytes: 3 * 1024 * 1024 })
            : await readFileAsDataURL(file)
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
        const realSize = Math.round((base64.length * 3) / 4)
        prepared.push({ name: file.name, type: file.type, data: dataUrl, size: realSize })
      } catch (err) {
        console.error("Erro ao processar anexo do PDI:", err)
        errors.push(`Não foi possível processar o arquivo "${file.name}".`)
      }
    }

    if (errors.length > 0) setFileError(errors.join(" "))
    if (prepared.length > 0) setAttachments((prev) => [...prev, ...prepared])
    setProcessingFile(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createPdiEvolution(studentId, {
        area,
        status,
        data,
        relato,
        proximosPassos,
        attachments,
      })
      toast.success("Evolução registrada com sucesso!")
      onCreated(created)
      setOpen(false)
      resetForm()
    } catch (error) {
      console.error("Erro ao registrar evolução:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a evolução.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md">
        <Plus className="h-4 w-4 mr-2" />
        Registrar evolução
      </Button>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar evolução</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Conte o que aconteceu - isso vira parte da linha do tempo da criança.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel className="text-foreground font-medium">Área *</FieldLabel>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PDI_AREAS.map((a) => (
                      <SelectItem key={a.key} value={a.key}>
                        {a.emoji} {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="evolucao-data" className="text-foreground font-medium">Data *</FieldLabel>
                <Input id="evolucao-data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </Field>
            </FieldGroup>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Status *</FieldLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PDI_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.emoji} {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="evolucao-relato" className="text-foreground font-medium">Registro / relato *</FieldLabel>
              <Textarea
                id="evolucao-relato"
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
                placeholder="O que aconteceu? Como a criança está nessa área?"
                rows={4}
                maxLength={5000}
                required
              />
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="evolucao-proximos" className="text-foreground font-medium">Próximos passos</FieldLabel>
              <Textarea
                id="evolucao-proximos"
                value={proximosPassos}
                onChange={(e) => setProximosPassos(e.target.value)}
                placeholder="O que deve ser feito a seguir?"
                rows={2}
                maxLength={2000}
              />
            </Field>
          </FieldGroup>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Responsável pelo registro</Label>
            <p className="text-sm text-muted-foreground">{user?.name || "-"}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                Anexos
              </Label>
              <span className="text-xs text-muted-foreground">{attachments.length}/{MAX_PDI_EVOLUTION_ATTACHMENTS}</span>
            </div>
            <input
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              id="evolucao-anexos"
              className="hidden"
              disabled={processingFile || attachments.length >= MAX_PDI_EVOLUTION_ATTACHMENTS}
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processingFile || attachments.length >= MAX_PDI_EVOLUTION_ATTACHMENTS}
              onClick={() => document.getElementById("evolucao-anexos")?.click()}
            >
              {processingFile ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Adicionar arquivos
                </>
              )}
            </Button>
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => {
                  const category = getAttachmentCategory(att.name, att.type)
                  const Icon = CATEGORY_ICON[category]
                  return (
                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded-md border border-border/60 bg-muted/20">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-destructive hover:text-destructive/80 shrink-0"
                        aria-label={`Remover ${att.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 font-semibold">
              {saving ? "Salvando..." : "Salvar evolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
