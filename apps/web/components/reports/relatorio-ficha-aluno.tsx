"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, FileDown, Printer } from "lucide-react"
import { SearchableSelect } from "./searchable-select"
import { openReportWindow, escapeHtml, shareOrSaveReportPdf } from "@/lib/report-print"
import type { Aluno, Turma } from "@/lib/types"

// "Ficha Cadastral do Aluno": consolida, num único documento imprimível, todos os dados de
// cadastro de uma criança (contato, responsável, oficina, turmas, datas). Reusa o cabeçalho/
// rodapé padrão de lib/report-print, igual aos relatórios de presença.
export function RelatorioFichaAluno({
  open,
  onOpenChange,
  students,
  classes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Aluno[]
  classes: Turma[]
}) {
  const [studentId, setStudentId] = useState<string | null>(null)
  const student = students.find((s) => s.id === studentId) || null

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])
  const turmasDoAluno = useMemo(() => {
    if (!student) return [] as Turma[]
    const ids = student.classIds?.length ? student.classIds : student.classId ? [student.classId] : []
    return ids.map((id) => classById.get(id)).filter((c): c is Turma => Boolean(c))
  }, [student, classById])

  const reset = () => setStudentId(null)

  // Campos que compõem a ficha, na ordem de exibição. Um valor vazio vira "-".
  const campos = useMemo(() => {
    if (!student) return [] as Array<{ label: string; value: string }>
    return [
      { label: "Nome completo", value: student.nome },
      { label: "CPF", value: student.cpf },
      { label: "Data de nascimento", value: formatDate(student.dataNascimento) },
      { label: "Idade", value: idade(student.dataNascimento) },
      { label: "E-mail", value: student.email },
      { label: "Telefone", value: student.telefone },
      { label: "Nome do responsável", value: student.nomeResponsavel || "" },
      { label: "Telefone do responsável", value: student.telefoneResponsavel || "" },
      { label: "Endereço", value: student.endereco },
      { label: "Escola", value: student.escola || "" },
      { label: "Oficina", value: student.curso },
      { label: "Turmas", value: turmasDoAluno.map((t) => t.nome).join(", ") },
      { label: "Data de acolhimento", value: formatDate(student.dataAcolhimento || "") },
      { label: "Data de cadastro", value: formatDate(student.createdAt) },
    ].map((c) => ({ label: c.label, value: c.value?.trim() ? c.value : "-" }))
  }, [student, turmasDoAluno])

  const buildBodyHtml = () => {
    if (!student) return ""
    const linhas = campos
      .map(
        (c) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;width:35%;font-weight:bold;">${escapeHtml(c.label)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(c.value)}</td>
        </tr>`
      )
      .join("")
    return `
      <h3>Dados cadastrais</h3>
      <table>
        <tbody>${linhas}</tbody>
      </table>
    `
  }

  const subtitle = `Ficha Cadastral do Aluno - Gerada em ${new Date().toLocaleDateString("pt-BR")}`

  // Baixa um PDF de verdade direto na máquina (não usa a janela/impressora de PDF).
  const handleDownloadPdf = async () => {
    if (!student) return
    await shareOrSaveReportPdf({
      filename: `Ficha - ${student.nome}`,
      subtitle,
      blocks: [
        { type: "heading", text: "Dados cadastrais" },
        { type: "keyValue", rows: campos.map((c) => [c.label, c.value] as [string, string]) },
      ],
    })
  }

  // Abre a janela de impressão do navegador (para imprimir em papel ou salvar via impressora).
  const handlePrint = () => {
    if (!student) return
    openReportWindow({
      title: `Ficha - ${student.nome}`,
      subtitle,
      bodyHtml: buildBodyHtml(),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Ficha Cadastral do Aluno
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione uma criança para visualizar e exportar todos os dados de cadastro dela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-foreground font-medium">Criança *</Label>
            <SearchableSelect
              options={students.map((s) => ({ id: s.id, label: s.nome }))}
              value={studentId}
              onChange={setStudentId}
              placeholder="Selecione a criança..."
              emptyMessage="Nenhuma criança encontrada."
            />
          </div>

          {student && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="rounded-md border border-border overflow-hidden">
                <dl className="divide-y divide-border">
                  {campos.map((c) => (
                    <div key={c.label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-3 py-2">
                      <dt className="text-xs text-muted-foreground sm:col-span-1">{c.label}</dt>
                      <dd className="text-sm font-medium text-foreground sm:col-span-2 break-words">{c.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadPdf} className="flex-1">
                  <FileDown className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
                <Button variant="outline" onClick={handlePrint} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Formata uma data (aceita "yyyy-mm-dd", ISO completo ou já em "dd/mm/aaaa") para "dd/mm/aaaa".
function formatDate(value: string): string {
  if (!value) return ""
  // Já está em dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const d = new Date(isoDateOnly ? value + "T12:00:00" : value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString("pt-BR")
}

// Calcula a idade em anos a partir da data de nascimento; string vazia se não der para calcular.
function idade(dataNascimento: string): string {
  if (!dataNascimento) return ""
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)
  let d: Date
  if (isoDateOnly) {
    d = new Date(dataNascimento + "T12:00:00")
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataNascimento)) {
    const [dia, mes, ano] = dataNascimento.split("/")
    d = new Date(Number(ano), Number(mes) - 1, Number(dia), 12)
  } else {
    d = new Date(dataNascimento)
  }
  if (isNaN(d.getTime())) return ""
  const hoje = new Date()
  let anos = hoje.getFullYear() - d.getFullYear()
  const m = hoje.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--
  return anos >= 0 && anos < 130 ? `${anos} anos` : ""
}
