import { Paperclip, Trash2 } from "lucide-react"
import { getPdiArea } from "@/lib/pdi-constants"
import { PdiStatusBadge } from "./pdi-status-badge"
import type { PdiEvolution } from "@/lib/types"

export function PdiTimeline({
  evolutions,
  canDelete,
  onDelete,
}: {
  evolutions: PdiEvolution[]
  canDelete?: boolean
  onDelete?: (evolution: PdiEvolution) => void
}) {
  if (evolutions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum registro de evolução encontrado.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {evolutions.map((ev) => {
        const area = getPdiArea(ev.area)
        return (
          <div key={ev.id} className="relative pl-6 border-l-2 border-border/60 last:border-transparent">
            <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-sm font-semibold text-foreground">
                {new Date(ev.data + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
              <span className="text-sm text-muted-foreground">
                {area.emoji} {area.label}
              </span>
              <PdiStatusBadge status={ev.status} />
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ev.relato}</p>
            {ev.proximosPassos && (
              <p className="text-xs text-muted-foreground mt-1.5">
                <span className="font-medium text-foreground">Próximos passos:</span> {ev.proximosPassos}
              </p>
            )}
            {ev.attachments && ev.attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {ev.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.data}
                    download={att.name}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Paperclip className="h-3 w-3" />
                    {att.name}
                  </a>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 pb-3">
              <span className="text-[11px] text-muted-foreground">
                Registrado por {ev.responsavelNome || "equipe"}
              </span>
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(ev)}
                  className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
