"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { AccessDenied } from "@/components/auth/access-denied"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, BookOpen, CheckCircle, GraduationCap, Users, ArrowRight } from "lucide-react"
import { getCourses, createCourse, updateCourse, deleteCourse, getClasses } from "@/lib/api"
import type { Course, Turma } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { TURMAS_HANDOFF_KEY, type TurmasHandoff } from "@/lib/turmas-handoff"

export default function CursosPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [classes, setClasses] = useState<Turma[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [sucesso, setSucesso] = useState("")
  const [error, setError] = useState("")

  // Exclusão com Modal
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    if (!user || (user.role !== "ADMIN" && user.role !== "DIRECTOR") ) return

    const loadData = async () => {
      setLoading(true)
      try {
        const [coursesData, classesData] = await Promise.all([
          getCourses(),
          getClasses().catch(() => []),
        ])
        setCourses(coursesData)
        setClasses(classesData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!user || (user.role !== "ADMIN" && user.role !== "DIRECTOR")) {
    return <AccessDenied />
  }

  // Turmas vinculadas a um curso: por courseId, com fallback pelo nome para turmas antigas sem courseId
  const turmasDoCurso = (course: Course) =>
    classes.filter(t => (t.courseId ? t.courseId === course.id : t.curso === course.name))

  const resetForm = () => {
    setForm({ name: "", description: "" })
    setEditingCourse(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSucesso("")

    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, form)
        setSucesso("Oficina atualizada com sucesso!")
      } else {
        await createCourse(form)
        setSucesso("Oficina cadastrada com sucesso!")
      }
      const data = await getCourses()
      setCourses(data)
      setDialogOpen(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar oficina")
    }

    setTimeout(() => setSucesso(""), 3000)
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setForm({
      name: course.name,
      description: course.description || "",
    })
    setDialogOpen(true)
  }

  const requestDelete = (course: Course) => {
    const turmasVinculadas = turmasDoCurso(course)

    if (turmasVinculadas.length > 0) {
      setError(
        `Não é possível excluir "${course.name}": ${turmasVinculadas.length} turma(s) estão vinculadas a esta oficina. Edite ou exclua essas turmas primeiro.`
      )
      setTimeout(() => setError(""), 5000)
      return
    }

    setCourseToDelete(course)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!courseToDelete) return
    setDeleting(true)

    try {
      await deleteCourse(courseToDelete.id)
      const data = await getCourses()
      setCourses(data)
      setSucesso("Oficina excluída com sucesso!")
      setDeleteDialogOpen(false)
      setCourseToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir oficina")
    } finally {
      setDeleting(false)
    }
    setTimeout(() => setSucesso(""), 3000)
  }

  // Envia o curso escolhido para a tela de Turmas e navega para lá
  const irParaTurmas = (course: Course, abrirNovaTurma: boolean) => {
    const handoff: TurmasHandoff = { courseId: course.id, courseName: course.name, abrirNovaTurma }
    sessionStorage.setItem(TURMAS_HANDOFF_KEY, JSON.stringify(handoff))
    router.push("/dashboard/turmas")
  }

  const totalTurmas = classes.length
  const totalAlunosMatriculados = classes.reduce((acc, t) => acc + (t.alunosMatriculados || 0), 0)

  return (
    <div className="space-y-6 pt-12 md:pt-0 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-7 w-7 text-primary" />Oficinas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as oficinas oferecidas pelo projeto e as turmas vinculadas a elas
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nova Oficina
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-background border border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingCourse ? "Editar Oficina" : "Cadastrar Nova Oficina"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Insira as informações da oficina.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name" className="text-foreground font-medium">Nome da Oficina *</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Violão Avançado, Dança de Rua"
                    required
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="description" className="text-foreground font-medium">Descrição</FieldLabel>
                  <Input
                    id="description"
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Resumo sobre o que é ensinado"
                  />
                </Field>
              </FieldGroup>

              <DialogFooter className="pt-4 border-t border-border/50">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="border-border hover:bg-muted">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" className="bg-primary hover:bg-primary/90 font-semibold px-6">
                  {editingCourse ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      {sucesso && (
        <Alert className="bg-success/10 border-success/30 text-success">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      {!loading && courses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-border/50 bg-card/30 py-0">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Oficinas Cadastradas</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{courses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/30 py-0">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-chart-3/10">
                <GraduationCap className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Turmas Vinculadas</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{totalTurmas}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/30 py-0">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Crianças Matriculadas</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{totalAlunosMatriculados}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Courses Feed */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : courses.length === 0 ? (
        <Card className="border-border/50 bg-card/30">
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30 text-primary" />
            <p className="font-semibold text-lg">Nenhuma oficina cadastrada</p>
            <p className="text-sm mt-1">
              Clique em "Nova Oficina" para começar a estruturar as turmas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const turmasVinculadas = turmasDoCurso(course)
            const turmasAtivas = turmasVinculadas.filter(t => t.status === "ativa").length
            const alunosMatriculados = turmasVinculadas.reduce((acc, t) => acc + (t.alunosMatriculados || 0), 0)

            return (
              <Card
                key={course.id}
                className="border-border/50 hover:shadow-md transition-all duration-300 bg-card/30 flex flex-col justify-between"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground truncate">{course.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 min-h-[32px] mt-1">
                    {course.description || "Sem descrição informada."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <button
                    type="button"
                    onClick={() => irParaTurmas(course, false)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-sm">
                        <GraduationCap className="h-4 w-4 text-chart-3" />
                        <span className="font-semibold text-foreground">{turmasVinculadas.length}</span>
                        <span className="text-muted-foreground text-xs">
                          {turmasVinculadas.length === 1 ? "turma" : "turmas"}
                          {turmasVinculadas.length > 0 && ` (${turmasAtivas} ativa${turmasAtivas === 1 ? "" : "s"})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-4 w-4 text-success" />
                        <span className="font-semibold text-foreground">{alunosMatriculados}</span>
                        <span className="text-muted-foreground text-xs">matriculado{alunosMatriculados === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </CardContent>

                <CardContent className="pt-2 border-t border-border/30 mt-2">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => irParaTurmas(course, true)}
                      className="h-8 text-xs border-primary text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Nova Turma
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(course)}
                      className="h-8 text-xs border-border"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => requestDelete(course)}
                      className="h-8 text-xs border-border text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de confirmação de exclusão de curso */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir Oficina</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-1">
              Tem certeza que deseja excluir a oficina <strong>"{courseToDelete?.name}"</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setCourseToDelete(null) }}
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
              {deleting ? "Excluindo..." : "Excluir Oficina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
