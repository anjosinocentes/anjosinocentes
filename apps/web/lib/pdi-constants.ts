// Configuração central da Central de PDIs. Áreas e status são uma lista fixa (mesmo padrão já
// usado no sistema para opções fixas, ex: diasSemanaOptions em turmas/page.tsx) - para adicionar,
// renomear ou remover uma área/status, edite só este arquivo.

export type PdiAreaKey =
  | "escolar"
  | "comportamento"
  | "psicologico"
  | "familiar"
  | "social"
  | "saude"
  | "odontologico"
  | "atividades_fisicas"
  | "atividades_complementares"
  | "outro"

export type PdiStatusKey = "atencao" | "acompanhamento" | "estavel" | "evolucao_positiva" | "concluido"

export const PDI_AREAS: { key: PdiAreaKey; label: string; emoji: string }[] = [
  { key: "escolar", label: "Escolar", emoji: "📚" },
  { key: "comportamento", label: "Comportamento", emoji: "🧠" },
  { key: "psicologico", label: "Psicológico", emoji: "❤️" },
  { key: "familiar", label: "Familiar", emoji: "👨‍👩‍👦" },
  { key: "social", label: "Social", emoji: "🤝" },
  { key: "saude", label: "Saúde", emoji: "🩺" },
  { key: "odontologico", label: "Odontológico", emoji: "🦷" },
  { key: "atividades_fisicas", label: "Atividades Físicas", emoji: "⚽" },
  { key: "atividades_complementares", label: "Atividades Complementares", emoji: "🎨" },
  { key: "outro", label: "Outro", emoji: "📌" },
]

export const PDI_STATUSES: { key: PdiStatusKey; label: string; emoji: string; color: string; bg: string }[] = [
  { key: "atencao", label: "Necessita atenção", emoji: "🔴", color: "text-destructive", bg: "bg-destructive/10" },
  { key: "acompanhamento", label: "Em acompanhamento", emoji: "🟡", color: "text-warning-foreground", bg: "bg-warning/20" },
  { key: "estavel", label: "Estável", emoji: "🔵", color: "text-chart-3", bg: "bg-chart-3/10" },
  { key: "evolucao_positiva", label: "Evolução positiva", emoji: "🟢", color: "text-success", bg: "bg-success/10" },
  { key: "concluido", label: "Concluído", emoji: "✅", color: "text-primary", bg: "bg-primary/10" },
]

export function getPdiArea(key: string) {
  return PDI_AREAS.find((a) => a.key === key) || { key, label: key || "Outro", emoji: "📌" }
}

export function getPdiStatus(key: string) {
  return PDI_STATUSES.find((s) => s.key === key) || PDI_STATUSES[1]
}

// "Situação geral" da criança (usada nos cards da Central de PDIs): resume várias áreas em um
// único status, priorizando o que precisa de mais atenção primeiro, não uma média/maioria.
export function getOverallPdiStatus(tracking: { status: string }[]) {
  if (tracking.length === 0) return getPdiStatus("acompanhamento")
  if (tracking.some((t) => t.status === "atencao")) return getPdiStatus("atencao")
  if (tracking.some((t) => t.status === "acompanhamento")) return getPdiStatus("acompanhamento")
  if (tracking.every((t) => t.status === "concluido")) return getPdiStatus("concluido")
  if (tracking.some((t) => t.status === "evolucao_positiva")) return getPdiStatus("evolucao_positiva")
  return getPdiStatus("estavel")
}

export const MAX_PDI_EVOLUTION_ATTACHMENTS = 3
export const MAX_PDI_EVOLUTION_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5 MB por arquivo

// Alertas do dashboard: quantos dias sem nenhum registro de evolução para considerar "parado".
export const PDI_STALE_DAYS = 60
// Quantos dias de antecedência para avisar que o prazo de um acompanhamento está próximo do fim.
export const PDI_DEADLINE_WARNING_DAYS = 15
