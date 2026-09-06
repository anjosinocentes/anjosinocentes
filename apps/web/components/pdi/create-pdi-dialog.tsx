"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Loader2 } from "lucide-react"
import { PDI_AREAS } from "@/lib/pdi-constants"
import { createStudentPdi } from "@/lib/api"
import type { Pdi } from "@/lib/types"
import { toast } from "sonner"

export function CreatePdiDialog({ studentId, onCreated }: { studentId: string; onCreated: (pdi: Pdi) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [situacaoInicial, setSituacaoInicial] = useState("")
  const [objetivosIniciais, setObjetivosIniciais] = useState("")
  const [observacoesIniciais, setObservacoesIniciais] = useState("")
  const [areas, setAreas] = useState<string[]>([])

  const resetForm = () => {
    setSituacaoInicial("")
    setObjetivosIniciais("")
    setObservacoesIniciais("")
    setAreas([])
  }

  const toggleArea = (key: string) => {
    setAreas((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createStudentPdi(studentId, {
        situacaoInicial,
        objetivosIniciais,
        observacoesIniciais,
        areas,
      })
      toast.success("PDI criado com sucesso!")
      onCreated(created)
      setOpen(false)
      resetForm()
    } catch (error) {
      console.error("Erro ao criar PDI:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o PDI.")
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
        Criar PDI
      </Button>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Criar PDI</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Registre a situação inicial da criança. Depois disso, o PDI é atualizado por meio dos registros de evolução.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pdi-situacao" className="text-foreground font-medium">Situação inicial *</FieldLabel>
              <Textarea
                id="pdi-situacao"
                value={situacaoInicial}
                onChange={(e) => setSituacaoInicial(e.target.value)}
                placeholder="Como a criança chegou até aqui? Contexto geral ao iniciar o acompanhamento."
                rows={4}
                maxLength={3000}
                required
              />
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pdi-objetivos" className="text-foreground font-medium">Objetivos iniciais</FieldLabel>
              <Textarea
                id="pdi-objetivos"
                value={objetivosIniciais}
                onChange={(e) => setObjetivosIniciais(e.target.value)}
                placeholder="O que se espera alcançar com o acompanhamento?"
                rows={3}
                maxLength={2000}
              />
            </Field>
          </FieldGroup>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Áreas que precisam de acompanhamento</Label>
            <div className="border border-border rounded-lg p-3 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-muted/10">
              {PDI_AREAS.map((a) => (
                <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-accent/40 select-none">
                  <Checkbox checked={areas.includes(a.key)} onCheckedChange={() => toggleArea(a.key)} />
                  <span className="text-foreground">
                    {a.emoji} {a.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pdi-observacoes" className="text-foreground font-medium">Observações</FieldLabel>
              <Textarea
                id="pdi-observacoes"
                value={observacoesIniciais}
                onChange={(e) => setObservacoesIniciais(e.target.value)}
                placeholder="Outras informações relevantes"
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
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar PDI"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
