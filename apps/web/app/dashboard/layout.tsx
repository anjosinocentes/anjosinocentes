"use client"

import Image from "next/image"
import { AppSidebar, useSidebarState } from "@/components/app-sidebar"
import { RequireAuth } from "@/components/auth/require-auth"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sidebarCollapsed = useSidebarState()

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <div className="print:hidden">
          <AppSidebar />
        </div>
        <main
          className={cn(
            "min-h-screen transition-all duration-300 print:ml-0",
            sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64",
          )}
        >
          {/* Cabeçalho só no mobile: logo pequeno centralizado, deixando o espaço do botão de
              menu (flutuante à esquerda). No desktop (md+) o logo já aparece na sidebar. */}
          <header className="md:hidden sticky top-0 z-30 flex h-16 items-center justify-center gap-2 border-b border-border bg-background/95 backdrop-blur px-14 print:hidden">
            <Image
              src="/logo.png"
              alt="Projeto Anjos Inocentes"
              width={120}
              height={44}
              priority
              className="h-11 w-auto object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">Anjos Inocentes</span>
              <span className="text-[11px] text-muted-foreground">Sistema de Gestão</span>
            </div>
          </header>
          <div className="p-4 md:p-6 lg:p-8 print:p-0">{children}</div>
        </main>
      </div>
    </RequireAuth>
  )
}
