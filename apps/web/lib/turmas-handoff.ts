// Usado para "entregar" um curso escolhido na tela de Cursos para a tela de Turmas
// (pré-selecionar o filtro ou abrir o formulário de nova turma já vinculado ao curso).
export const TURMAS_HANDOFF_KEY = "turmas_handoff"

export interface TurmasHandoff {
  courseId: string
  courseName: string
  abrirNovaTurma: boolean
}
