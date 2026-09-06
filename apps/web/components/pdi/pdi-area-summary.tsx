import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPdiArea } from "@/lib/pdi-constants"
import { PdiStatusBadge } from "./pdi-status-badge"
import type { PdiTrackingSummary } from "@/lib/api"

export function PdiAreaSummary({ tracking }: { tracking: PdiTrackingSummary[] | { area: string; status: string }[] }) {
  if (tracking.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nenhuma área em acompanhamento ainda.
      </p>
    )
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold text-foreground text-sm">Área</TableHead>
            <TableHead className="font-semibold text-foreground text-sm">Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tracking.map((t) => {
            const area = getPdiArea(t.area)
            return (
              <TableRow key={t.area}>
                <TableCell className="font-medium text-foreground">
                  {area.emoji} {area.label}
                </TableCell>
                <TableCell>
                  <PdiStatusBadge status={t.status} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
