"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Pencil } from "lucide-react"
import { updateStudentPdi } from "@/lib/api"
import type { Pdi } from "@/lib/types"
import { toast } from "sonner"

// Permite corrigir o histórico inicial depois de criado (ex.: erro de digitação) - o restante
// do PDI (acompanhamentos, evoluções, marcos) tem seus próprios fluxos de edição/histórico.
export function EditPdiInitialDialog({ studentId, pdi, onUpdated }: { studentId: string; pdi: Pdi; onUpdated: (pdi: Pdi) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [situacaoInicial, setSituacaoInicial] = useState(pdi.situacaoInicial)
  const [objetivosIniciais, setObjetivosIniciais] = useState(pdi.objetivosIniciais || "")
  const [observacoesIniciais, setObservacoesIniciais] = useState(pdi.observacoesIniciais || "")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSituacaoInicial(pdi.situacaoInicial)
      setObjetivosIniciais(pdi.objetivosIniciais || "")
      setObservacoesIniciais(pdi.observacoesIniciais || "")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateStudentPdi(studentId, { situacaoInicial, objetivosIniciais, observacoesIniciais })
      toast.success("Histórico inicial atualizado!")
      onUpdated(updated)
      setOpen(false)
    } catch (error) {
      console.error("Erro ao editar histórico inicial:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o histórico inicial.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="ghost" size="sm" onClick={() => handleOpenChange(true)} className="h-7 text-xs text-muted-foreground">
        <Pencil className="h-3 w-3 mr-1" />
        Editar
      </Button>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar histórico inicial</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Corrige o registro do início do acompanhamento. Não afeta acompanhamentos, evoluções ou marcos já lançados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Situação inicial *</FieldLabel>
              <Textarea
                value={situacaoInicial}
                onChange={(e) => setSituacaoInicial(e.target.value)}
                rows={4}
                maxLength={3000}
                required
              />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Objetivos iniciais</FieldLabel>
              <Textarea
                value={objetivosIniciais}
                onChange={(e) => setObjetivosIniciais(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-foreground font-medium">Observações</FieldLabel>
              <Textarea
                value={observacoesIniciais}
                onChange={(e) => setObservacoesIniciais(e.target.value)}
                rows={2}
                maxLength={3000}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 font-semibold">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
