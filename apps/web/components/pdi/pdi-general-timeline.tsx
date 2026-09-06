import { Trash2 } from "lucide-react"

// Item já resolvido para exibição - ver app/dashboard/pdis/[studentId]/page.tsx (useMemo que
// mescla evoluções por área, marcos gerais e a entrada na instituição num único item por linha).
export type GeneralTimelineItem = {
  key: string
  data: string
  emoji: string
  label: string
  descricao?: string
  kind: "evolution" | "evento" | "entrada"
  eventId?: string
}

// Linha do tempo GERAL (item 15 do pedido): além do histórico por área (PdiTimeline), reúne
// numa lista compacta os acontecimentos importantes de todas as áreas + marcos institucionais
// (visita domiciliar, entrada na instituição) que não pertencem a nenhuma área específica.
export function PdiGeneralTimeline({
  items,
  canDeleteEvent,
  onDeleteEvent,
}: {
  items: GeneralTimelineItem[]
  canDeleteEvent?: boolean
  onDeleteEvent?: (eventId: string) => void
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nenhum acontecimento registrado ainda.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.key} className="flex items-start gap-3 text-sm">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-[88px] pt-0.5">
            {new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}
          </span>
          <span className="shrink-0">{item.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-foreground">{item.label}</p>
            {item.descricao && <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>}
          </div>
          {item.kind === "evento" && canDeleteEvent && onDeleteEvent && item.eventId && (
            <button
              type="button"
              onClick={() => onDeleteEvent(item.eventId!)}
              className="text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Excluir marco"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
