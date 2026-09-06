"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Trash2 } from "lucide-react"
import { getPdiArea, PDI_STATUSES } from "@/lib/pdi-constants"
import { PdiStatusBadge } from "./pdi-status-badge"
import { updatePdiTracking } from "@/lib/api"
import type { PdiTracking } from "@/lib/types"
import { toast } from "sonner"

export function PdiTrackingCard({
  studentId,
  tracking,
  onUpdated,
  onRequestDelete,
}: {
  studentId: string
  tracking: PdiTracking
  onUpdated: (tracking: PdiTracking) => void
  onRequestDelete: (tracking: PdiTracking) => void
}) {
  const area = getPdiArea(tracking.area)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [objetivo, setObjetivo] = useState(tracking.objetivo)
  const [descricao, setDescricao] = useState(tracking.descricao || "")
  const [prazo, setPrazo] = useState(tracking.prazo || "")
  const [status, setStatus] = useState(tracking.status)
  const [observacoes, setObservacoes] = useState(tracking.observacoes || "")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updatePdiTracking(studentId, tracking.id, { objetivo, descricao, prazo: prazo || null, status, observacoes })
      onUpdated({ ...tracking, objetivo, descricao, prazo: prazo || null, status, observacoes })
      toast.success("Acompanhamento atualizado com sucesso!")
      setEditOpen(false)
    } catch (error) {
      console.error("Erro ao atualizar acompanhamento:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o acompanhamento.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {area.emoji} {area.label}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{tracking.objetivo}</p>
          </div>
          <PdiStatusBadge status={tracking.status} />
        </div>

        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          <span>Responsável: {tracking.responsavelNome || "-"}</span>
          <span>Última atualização: {new Date(tracking.updatedAt).toLocaleDateString("pt-BR")}</span>
          {tracking.prazo && <span>Prazo: {new Date(tracking.prazo + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRequestDelete(tracking)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir
          </Button>
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Editar acompanhamento · {area.emoji} {area.label}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <FieldGroup>
              <Field>
                <FieldLabel className="text-foreground font-medium">Objetivo *</FieldLabel>
                <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={300} required />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel className="text-foreground font-medium">Descrição</FieldLabel>
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} />
              </Field>
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel className="text-foreground font-medium">Status</FieldLabel>
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
                  <FieldLabel className="text-foreground font-medium">Prazo</FieldLabel>
                  <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                </Field>
              </FieldGroup>
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel className="text-foreground font-medium">Observações</FieldLabel>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={2000} />
              </Field>
            </FieldGroup>
            <DialogFooter className="pt-2 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 font-semibold">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
