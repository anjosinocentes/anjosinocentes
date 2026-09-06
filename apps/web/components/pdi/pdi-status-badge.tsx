import { getPdiStatus } from "@/lib/pdi-constants"

export function PdiStatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const info = getPdiStatus(status)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${info.color} ${info.bg} ${className}`}
    >
      <span aria-hidden>{info.emoji}</span>
      {info.label}
    </span>
  )
}
