"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

export type SearchableSelectOption = { id: string; label: string; hint?: string }

// Select com busca (item 8: "utilizar pesquisa para facilitar a localização quando houver
// muitos registros") - usado para escolher criança/turma nos relatórios de presença.
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyMessage = "Nenhum resultado encontrado.",
}: {
  options: SearchableSelectOption[]
  value: string | null
  onChange: (id: string) => void
  placeholder: string
  emptyMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("h-4 w-4", value === option.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                  {option.hint && <span className="ml-auto text-xs text-muted-foreground shrink-0">{option.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
