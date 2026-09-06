"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Plus } from "lucide-react"
import { createPdiEvent } from "@/lib/api"
import type { PdiEvent } from "@/lib/types"
import { toast } from "sonner"

function getLocalDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// "+ Adicionar marco" da linha do tempo geral - para acontecimentos que não pertencem a uma
// área acompanhada (ex.: visita domiciliar), diferente de "Registrar evolução".
export function AddPdiEventDialog({ studentId, onCreated }: { studentId: string; onCreated: (evento: PdiEvent) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(getLocalDateString())
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")

  const resetForm = () => {
    setData(getLocalDateString())
    setTitulo("")
    setDescricao("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createPdiEvent(studentId, { data, titulo, descricao })
      toast.success("Marco registrado com sucesso!")
      onCreated(created)
      setOpen(false)
      resetForm()
    } catch (error) {
      console.error("Erro ao registrar marco:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o marco.")
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Adicionar marco
      </Button>
      <DialogContent className="max-w-md bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adicionar marco</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Para acontecimentos importantes que não pertencem a uma área específica (ex.: visita domiciliar).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="evento-data" className="text-foreground font-medium">Data *</FieldLabel>
              <Input id="evento-data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="evento-titulo" className="text-foreground font-medium">Título *</FieldLabel>
              <Input
                id="evento-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Visita domiciliar"
                maxLength={150}
                required
              />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="evento-descricao" className="text-foreground font-medium">Descrição</FieldLabel>
              <Textarea
                id="evento-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                maxLength={2000}
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
