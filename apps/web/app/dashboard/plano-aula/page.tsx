"use client"

import { useState, useEffect } from "react"
import { RequirePermission } from "@/components/auth/require-permission"
import { PERMISSIONS } from "@/lib/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  NotebookPen,
  Calendar,
  Eye,
  FileText,
  X,
  Download,
  Filter
} from "lucide-react"
import { BookOpen } from "lucide-react"
import { getLessonPlans, createLessonPlan, updateLessonPlan, deleteLessonPlan, getClasses } from "@/lib/api"
import type { PlanoAula, Turma } from "@/lib/types"

export default function AulasPage() {
  const [registros, setRegistros] = useState<PlanoAula[]>([])
  const [turmasList, setTurmasList] = useState<Turma[]>([])
  const [filtroTurma, setFiltroTurma] = useState("todas")
  const [filtroDataInicio, setFiltroDataInicio] = useState("")
  const [filtroDataFim, setFiltroDataFim] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editingRegistro, setEditingRegistro] = useState<PlanoAula | null>(null)
  const [viewingRegistro, setViewingRegistro] = useState<PlanoAula | null>(null)
  const [sucesso, setSucesso] = useState("")
  const [uploading, setUploading] = useState(false)

  // Form state
  const [form, setForm] = useState({
    data: "",
    turma: "",
    classId: "",
    disciplina: "",
    conteudo: "",
    observacoes: "",
    files: [] as string[],
  })

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [plans, classes] = await Promise.all([
          getLessonPlans(),
          getClasses(),
        ])
        setRegistros(plans)
        setTurmasList(classes.filter(c => c.status === "ativa"))
      } catch (error) {
        console.error("Erro ao carregar dados iniciais do diário de aula:", error)
      }
    }

    loadInitialData()
  }, [])

  const resetForm = () => {
    setForm({
      data: "",
      turma: "",
      classId: "",
      disciplina: "",
      conteudo: "",
      observacoes: "",
      files: [],
    })
    setEditingRegistro(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingRegistro) {
        await updateLessonPlan(editingRegistro.id, form)
        setSucesso("Registro de aula atualizado com sucesso!")
      } else {
        await createLessonPlan(form)
        setSucesso("Aula registrada com sucesso!")
      }

      const plans = await getLessonPlans()
      setRegistros(plans)
      setDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Erro ao salvar registro de aula:", error)
      setSucesso("Erro ao salvar o registro. Tente novamente.")
    }

    setTimeout(() => setSucesso(""), 3000)
  }

  const handleEdit = (registro: PlanoAula) => {
    setEditingRegistro(registro)
    setForm({
      data: registro.data,
      turma: registro.turma,
      classId: registro.classId || "",
      disciplina: registro.disciplina,
      conteudo: registro.conteudo,
      observacoes: registro.observacoes,
      files: registro.files || [],
    })
    setDialogOpen(true)
  }

  const handleView = (registro: PlanoAula) => {
    setViewingRegistro(registro)
    setViewDialogOpen(true)
  }

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [registroToDelete, setRegistroToDelete] = useState<PlanoAula | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      const readAsDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      const newFileUrls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dataUrl = await readAsDataURL(file)
        newFileUrls.push(dataUrl)
      }

      setForm((prev) => ({
        ...prev,
        files: [...prev.files, ...newFileUrls],
      }))
    } catch (error) {
      console.error("Erro no upload:", error)
      alert("Erro ao ler os arquivos. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = (fileUrl: string) => {
    setForm((prev) => ({
      ...prev,
      files: prev.files.filter((url) => url !== fileUrl),
    }))
  }

  const requestDelete = (registro: PlanoAula) => {
    setRegistroToDelete(registro)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!registroToDelete) return
    setDeleting(true)

    try {
      await deleteLessonPlan(registroToDelete.id)
      const plans = await getLessonPlans()
      setRegistros(plans)
      setSucesso("Registro de aula excluído com sucesso!")
      setDeleteDialogOpen(false)
      setRegistroToDelete(null)
    } catch (error) {
      console.error("Erro ao excluir registro de aula:", error)
      setSucesso("Erro ao excluir o registro. Tente novamente.")
    } finally {
      setDeleting(false)
    }

    setTimeout(() => setSucesso(""), 3000)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // Mais recente primeiro: um diário de aula é consultado de trás pra frente, não em ordem de cadastro
  const registrosOrdenados = [...registros].sort((a, b) => b.data.localeCompare(a.data))

  const registrosFiltrados = registrosOrdenados.filter(r => {
    const matchTurma = filtroTurma === "todas" || r.classId === filtroTurma
    const matchInicio = !filtroDataInicio || r.data >= filtroDataInicio
    const matchFim = !filtroDataFim || r.data <= filtroDataFim
    return matchTurma && matchInicio && matchFim
  })

  const limparFiltros = () => {
    setFiltroTurma("todas")
    setFiltroDataInicio("")
    setFiltroDataFim("")
  }

  const filtrosAtivos = filtroTurma !== "todas" || !!filtroDataInicio || !!filtroDataFim

  return (
    <RequirePermission permission={PERMISSIONS.PLANO_AULA}>
    <div className="space-y-6 pt-12 md:pt-0 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-7 w-7 text-primary" />Aulas</h1>
          <p className="text-muted-foreground mt-1">
            Registre o que foi trabalhado em cada aula: conteúdo, materiais e comentários
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingRegistro ? "Editar Registro de Aula" : "Registrar Aula"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Conte o que foi feito na aula e anexe os materiais utilizados
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="data" className="text-foreground font-medium">Data da Aula *</FieldLabel>
                    <Input
                      id="data"
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm({ ...form, data: e.target.value })}
                      required
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="turma" className="text-foreground font-medium">Turma *</FieldLabel>
                    <Select
                      value={form.classId}
                      onValueChange={(value) => {
                        const selected = turmasList.find(t => t.id === value)
                        setForm({
                          ...form,
                          classId: value,
                          turma: selected ? `${selected.nome} (${selected.curso})` : "",
                          disciplina: selected?.curso || "",
                        })
                      }}
                    >
                      <SelectTrigger id="turma">
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {turmasList.map((turma) => (
                          <SelectItem key={turma.id} value={turma.id}>
                            {turma.nome} ({turma.curso})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="conteudo" className="text-foreground font-medium">O que foi trabalhado na aula *</FieldLabel>
                  <Textarea
                    id="conteudo"
                    value={form.conteudo}
                    onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                    placeholder="Conteúdo, atividades e slides utilizados nesta aula..."
                    rows={5}
                    required
                    className="resize-none"
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="observacoes" className="text-foreground font-medium">Comentários do Professor</FieldLabel>
                  <Textarea
                    id="observacoes"
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Como foi a aula, participação das crianças, pontos de atenção..."
                    rows={3}
                    className="resize-none"
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel className="text-foreground font-medium">Materiais da Aula (slides, atividades, fotos...)</FieldLabel>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                        id="file-upload-input"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("file-upload-input")?.click()}
                        disabled={uploading}
                        className="border-dashed border-2 hover:bg-muted py-6 flex flex-col items-center justify-center gap-1 w-full"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Anexar Materiais</span>
                        <span className="text-xs text-muted-foreground">Slides, PDFs, imagens, documentos</span>
                      </Button>
                    </div>

                    {uploading && (
                      <p className="text-xs text-muted-foreground animate-pulse">Enviando arquivos...</p>
                    )}

                    {form.files && form.files.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-1">
                        {form.files.map((fileUrl, index) => {
                          const fileName = fileUrl.split("/").pop() || `Arquivo ${index + 1}`
                          return (
                            <div key={fileUrl} className="flex items-center justify-between p-2 bg-muted/40 rounded-lg border border-border">
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-xs truncate">{fileName}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveFile(fileUrl)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </Field>
              </FieldGroup>

              <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    resetForm()
                  }}
                  className="border-border hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-md">
                  {editingRegistro ? "Salvar Alterações" : "Registrar Aula"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Success Alert */}
      {sucesso && (
        <Alert className="bg-success/10 border-success/30 text-success">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="border-border/50 py-0">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <NotebookPen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total de Registros</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{registros.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 py-0">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-success/10">
              <Calendar className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Registrados Hoje</p>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {registros.filter(p => p.data === todayStr).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Aulas Registradas</CardTitle>
                <CardDescription className="text-xs">
                  {registrosFiltrados.length} registro(s)
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={filtroTurma} onValueChange={setFiltroTurma}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as turmas</SelectItem>
                    {turmasList.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome} ({turma.curso})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <FieldLabel htmlFor="filtroDataInicio" className="text-xs text-muted-foreground font-normal">De</FieldLabel>
                  <Input
                    id="filtroDataInicio"
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="filtroDataFim" className="text-xs text-muted-foreground font-normal">Até</FieldLabel>
                  <Input
                    id="filtroDataFim"
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    min={filtroDataInicio}
                    className="w-full sm:w-40"
                  />
                </div>
                {filtrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-xs text-muted-foreground">
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {registrosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <NotebookPen className="h-12 w-12 mx-auto mb-4 opacity-30 text-primary" />
              <p className="font-semibold">
                {registros.length === 0 ? "Nenhuma aula registrada ainda" : "Nenhum registro encontrado para esse filtro"}
              </p>
              <p className="text-sm mt-1">
                {registros.length === 0
                  ? 'Clique em "Novo Registro" para documentar uma aula'
                  : 'Tente ajustar a turma ou o período selecionado'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-foreground text-sm">Data</TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">Turma</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-foreground text-sm">O que foi trabalhado</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-foreground text-sm">Materiais</TableHead>
                    <TableHead className="text-right font-semibold text-foreground text-sm w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.map((registro) => (
                    <TableRow key={registro.id} className="hover:bg-accent/20">
                      <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                        {formatDate(registro.data)}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{registro.turma}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{registro.disciplina}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-muted-foreground truncate max-w-[360px]" title={registro.conteudo}>
                          {registro.conteudo}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {registro.files && registro.files.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                            <FileText className="h-3.5 w-3.5" />
                            {registro.files.length}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(registro)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(registro)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestDelete(registro)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Excluir registro"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <NotebookPen className="h-5 w-5 text-primary" />
              {viewingRegistro?.turma}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {viewingRegistro?.disciplina} - {viewingRegistro && formatDate(viewingRegistro.data)}
            </DialogDescription>
          </DialogHeader>

          {viewingRegistro && (
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1.5">O que foi trabalhado na aula</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 border border-border/50 p-4 rounded-lg">
                  {viewingRegistro.conteudo}
                </p>
              </div>

              {viewingRegistro.observacoes && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1.5">Comentários do Professor</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 border border-border/50 p-4 rounded-lg">
                    {viewingRegistro.observacoes}
                  </p>
                </div>
              )}

              {viewingRegistro.files && viewingRegistro.files.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1.5">Materiais da Aula</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {viewingRegistro.files.map((fileUrl: string, index: number) => {
                      const isDataUrl = fileUrl.startsWith("data:")
                      const fileName = isDataUrl ? `Material ${index + 1}` : (fileUrl.split("/").pop() || `Arquivo ${index + 1}`)
                      const downloadUrl = fileUrl
                      return (
                        <a
                          key={index}
                          href={downloadUrl}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 bg-muted/40 hover:bg-muted/80 rounded-lg border border-border transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs truncate group-hover:text-primary transition-colors">{fileName}</span>
                          </div>
                          <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                  className="border-border hover:bg-muted"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão do registro */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir Registro de Aula</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1">
              Tem certeza que deseja excluir o registro da aula de <strong>"{registroToDelete?.turma}"</strong> em {registroToDelete && formatDate(registroToDelete.data)}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setRegistroToDelete(null) }}
              disabled={deleting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-xs"
            >
              {deleting ? "Excluindo..." : "Excluir Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RequirePermission>
  )
}
