"use client"

import { useState, useEffect, useMemo } from "react"
import { RequirePermission } from "@/components/auth/require-permission"
import { PERMISSIONS, hasPermission } from "@/lib/permissions"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Megaphone,
  Plus,
  CheckCircle,
  Calendar,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Pencil,
  Paperclip,
  Search,
} from "lucide-react"
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, type Announcement, type AnnouncementAttachment, type AnnouncementTipo } from "@/lib/api"
import { checkFile, checkAttachmentSet, ACCEPT_ATTRIBUTE, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_ANNOUNCEMENT, formatFileSize } from "@/lib/attachment-utils"
import { AttachmentPreviewItem } from "@/components/comunicacao/attachment-preview-item"
import { AttachmentDisplay } from "@/components/comunicacao/attachment-display"

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  DIRECTOR: "Diretor",
  COORDINATOR: "Coordenador",
  SECRETARY: "Secretário(a)",
  TEACHER: "Professor",
  STUDENT: "Criança",
}

const tipoConfig: Record<AnnouncementTipo, { label: string; badge: string; border: string; icon: typeof Info }> = {
  informativo: {
    label: "Informativo",
    badge: "bg-primary/15 text-primary border-primary/20",
    border: "border-l-primary",
    icon: Info,
  },
  importante: {
    label: "Importante",
    badge: "bg-warning/15 text-warning border-warning/20",
    border: "border-l-warning",
    icon: AlertTriangle,
  },
  urgente: {
    label: "Urgente",
    badge: "bg-destructive/15 text-destructive border-destructive/20",
    border: "border-l-destructive",
    icon: AlertCircle,
  },
}

const BODY_PREVIEW_LENGTH = 320

export default function ComunicacaoPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null)
  const [sucesso, setSucesso] = useState("")
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<"todos" | AnnouncementTipo>("todos")

  const [form, setForm] = useState<{
    title: string
    body: string
    tipo: AnnouncementTipo
    attachments: AnnouncementAttachment[]
  }>({
    title: "",
    body: "",
    tipo: "informativo",
    attachments: []
  })

  const isDirector = hasPermission(user, PERMISSIONS.COMUNICACAO)

  const loadAnnouncements = async () => {
    try {
      const data = await getAnnouncements()
      setAnnouncements(data)
    } catch (error) {
      console.error("Erro ao carregar avisos:", error)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const showFeedback = (msg: string, type: "ok" | "err") => {
    if (type === "ok") setSucesso(msg)
    else setErro(msg)
    setTimeout(() => { setSucesso(""); setErro("") }, 4000)
  }

  const resetForm = () => {
    setForm({ title: "", body: "", tipo: "informativo", attachments: [] })
    setEditingAnnouncement(null)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setForm({
      title: announcement.title,
      body: announcement.body,
      tipo: announcement.tipo || "informativo",
      attachments: announcement.attachments || []
    })
    setDialogOpen(true)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const selected = Array.from(files)
    e.target.value = "" // permite selecionar o mesmo arquivo de novo depois de remover

    // Checa quantidade e tamanho total combinado (existentes + novos) antes de ler qualquer arquivo.
    const prospective = [...form.attachments, ...selected.map(f => ({ name: f.name, size: f.size }))]
    const setCheck = checkAttachmentSet(prospective)
    if (!setCheck.ok) {
      showFeedback(setCheck.reason, "err")
      return
    }

    selected.forEach(file => {
      const check = checkFile(file.name, file.type, file.size)
      if (!check.ok) {
        showFeedback(check.reason, "err")
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64Data = event.target?.result as string
        if (base64Data) {
          setForm(prev => ({
            ...prev,
            attachments: [
              ...prev.attachments,
              {
                name: file.name,
                type: file.type,
                data: base64Data,
                size: file.size
              }
            ]
          }))
        }
      }
      reader.onerror = () => showFeedback(`Não foi possível carregar o arquivo "${file.name}". Tente novamente.`, "err")
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveAttachment = (index: number) => {
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro("")

    if (!form.title.trim() || !form.body.trim()) {
      setErro("Título e Mensagem são campos obrigatórios e não podem estar vazios.")
      return
    }

    setLoading(true)
    try {
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, form)
        showFeedback("Aviso atualizado com sucesso!", "ok")
      } else {
        await createAnnouncement(form)
        showFeedback("Aviso publicado com sucesso!", "ok")
      }
      resetForm()
      setDialogOpen(false)
      await loadAnnouncements()
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "Erro ao salvar aviso.", "err")
    } finally {
      setLoading(false)
    }
  }

  const requestDelete = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!announcementToDelete) return
    setDeleting(true)
    try {
      await deleteAnnouncement(announcementToDelete.id)
      setAnnouncements(prev => prev.filter(a => a.id !== announcementToDelete.id))
      setDeleteDialogOpen(false)
      setAnnouncementToDelete(null)
      showFeedback("Aviso excluído com sucesso!", "ok")
    } catch (error) {
      console.error("Erro ao excluir aviso:", error)
      showFeedback(error instanceof Error ? error.message : "Erro ao excluir aviso.", "err")
    } finally {
      setDeleting(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getInitials = (name: string) =>
    name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()

  // Mais recente primeiro, já vem ordenado do backend, mas garante mesmo se algo mudar
  const announcementsOrdenados = useMemo(
    () => [...announcements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [announcements]
  )

  const announcementsFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase()
    return announcementsOrdenados.filter(a => {
      const matchTipo = filtroTipo === "todos" || (a.tipo || "informativo") === filtroTipo
      const matchBusca = !buscaNorm ||
        (a.title || "").toLowerCase().includes(buscaNorm) ||
        (a.body || "").toLowerCase().includes(buscaNorm)
      return matchTipo && matchBusca
    })
  }, [announcementsOrdenados, busca, filtroTipo])

  return (
    <RequirePermission permission={PERMISSIONS.COMUNICACAO}>
      <div className="space-y-6 pt-12 md:pt-0 animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"><Megaphone className="h-7 w-7 text-primary" />Comunicação Interna</h1>
            <p className="text-muted-foreground mt-1">
              Consulte e acompanhe os avisos e comunicados importantes para a equipe
            </p>
          </div>

          {isDirector && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Publicar Aviso
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-background border border-border max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    {editingAnnouncement ? "Editar Aviso" : "Publicar Novo Aviso"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Este aviso ficará visível para toda a equipe do projeto.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="title" className="text-foreground font-medium">Título *</FieldLabel>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="Ex: Reunião Geral de Planejamento"
                        maxLength={200}
                        required
                      />
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="tipo" className="text-foreground font-medium">Tipo do Aviso</FieldLabel>
                      <Select value={form.tipo} onValueChange={(value: AnnouncementTipo) => setForm({ ...form, tipo: value })}>
                        <SelectTrigger id="tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="informativo">Informativo</SelectItem>
                          <SelectItem value="importante">Importante</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="body" className="text-foreground font-medium">Mensagem *</FieldLabel>
                      <Textarea
                        id="body"
                        value={form.body}
                        onChange={e => setForm({ ...form, body: e.target.value })}
                        placeholder="Escreva a mensagem do comunicado aqui..."
                        maxLength={5000}
                        rows={5}
                        required
                        className="resize-none"
                      />
                    </Field>
                  </FieldGroup>

                  {/* Anexos */}
                  <FieldGroup>
                    <Field>
                      <FieldLabel className="text-foreground font-medium">
                        Anexos (imagens, PDF, Word, Excel, PowerPoint — máx {formatFileSize(MAX_FILE_SIZE_BYTES)} por arquivo, até {MAX_FILES_PER_ANNOUNCEMENT} arquivos)
                      </FieldLabel>
                      <div className="flex flex-col gap-2">
                        <Input
                          type="file"
                          accept={ACCEPT_ATTRIBUTE}
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          id="announcement-file-input"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById("announcement-file-input")?.click()}
                          className="border-dashed border-2 hover:bg-muted flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground"
                        >
                          <Paperclip className="h-4 w-4" />
                          <span>Selecionar arquivos</span>
                        </Button>

                        {form.attachments.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {form.attachments.map((file, idx) => (
                              <AttachmentPreviewItem
                                key={idx}
                                attachment={file}
                                onRemove={() => handleRemoveAttachment(idx)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </Field>
                  </FieldGroup>

                  <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6">
                      {loading ? "Salvando..." : (editingAnnouncement ? "Salvar Alterações" : "Publicar")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Feedback */}
        {sucesso && (
          <Alert className="bg-success/10 border-success/30 text-success">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{sucesso}</AlertDescription>
          </Alert>
        )}
        {erro && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {/* Confirm Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-sm bg-background border border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Excluir Aviso</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm mt-1">
                Tem certeza que deseja excluir o aviso <strong>"{announcementToDelete?.title}"</strong>? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => { setDeleteDialogOpen(false); setAnnouncementToDelete(null) }}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <div className="max-w-4xl flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou conteúdo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filtroTipo} onValueChange={(v: "todos" | AnnouncementTipo) => setFiltroTipo(v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="informativo">Informativo</SelectItem>
              <SelectItem value="importante">Importante</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notice Board */}
        <div className="max-w-4xl space-y-4">
          {announcementsFiltrados.length === 0 ? (
            <Card className="border-border/50 bg-card/30">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30 text-primary" />
                <p className="font-semibold text-lg">
                  {announcements.length === 0 ? "Mural de avisos vazio" : "Nenhum aviso encontrado"}
                </p>
                <p className="text-sm mt-1">
                  {announcements.length === 0
                    ? (isDirector
                      ? 'Clique em "Publicar Aviso" para enviar o primeiro comunicado.'
                      : "Não há comunicados internos publicados no momento.")
                    : "Tente ajustar a busca ou o filtro de tipo."}
                </p>
              </CardContent>
            </Card>
          ) : (
            announcementsFiltrados.map(announcement => {
              const tipo = tipoConfig[announcement.tipo || "informativo"]
              const TipoIcon = tipo.icon
              const body = announcement.body || ""
              const isLong = body.length > BODY_PREVIEW_LENGTH
              const isExpanded = expandedIds.has(announcement.id)
              const displayBody = isLong && !isExpanded
                ? body.slice(0, BODY_PREVIEW_LENGTH).trimEnd() + "…"
                : body

              return (
                <Card
                  key={announcement.id}
                  className={`border-border/50 border-l-4 ${tipo.border} hover:shadow-md transition-all duration-300 bg-card/30`}
                >
                  <CardHeader className="pb-3 border-b border-border/30">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0 select-none">
                        {announcement.author?.name ? getInitials(announcement.author.name) : "AI"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-bold text-foreground text-base sm:text-lg truncate">
                              {announcement.title}
                            </h3>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${tipo.badge}`}>
                              <TipoIcon className="h-3 w-3" />
                              {tipo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="flex items-center text-[10px] sm:text-xs text-muted-foreground font-medium bg-muted/60 px-2 py-0.5 rounded-full border border-border/50">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(announcement.createdAt)}
                            </span>
                            {isDirector && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  onClick={() => handleEdit(announcement)}
                                  title="Editar aviso"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => requestDelete(announcement)}
                                  title="Excluir aviso"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {announcement.author?.name || "Administrador"}
                          </p>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary/15 text-primary rounded border border-primary/20">
                            {roleLabels[announcement.author?.role || ""] || "Colaborador"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="text-sm sm:text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {displayBody}
                      </p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(announcement.id)}
                          className="text-xs font-semibold text-primary hover:underline mt-1"
                        >
                          {isExpanded ? "Ver menos" : "Ver mais"}
                        </button>
                      )}
                    </div>

                    {/* Display Attachments */}
                    {announcement.attachments && announcement.attachments.length > 0 && (
                      <div className="pt-3 border-t border-border/40">
                        <AttachmentDisplay attachments={announcement.attachments} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </RequirePermission>
  )
}
