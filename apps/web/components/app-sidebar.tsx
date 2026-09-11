"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  BookOpen,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BarChart3,
  Settings,
  Calendar,
  HelpCircle,
  UserCog,
  Megaphone,
  ClipboardList,
  Brain,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/components/auth/auth-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import type { UserRole } from "@/lib/auth"
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  roles?: UserRole[]
  permission?: Permission
}

const menuItems: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/comunicacao", label: "Comunicação", icon: Megaphone, permission: PERMISSIONS.COMUNICACAO },
    ],
  },
  {
    group: "Gestão",
    items: [
      { href: "/dashboard/criancas", label: "Crianças", icon: Users, permission: PERMISSIONS.ALUNOS },
      { href: "/dashboard/oficinas", label: "Oficinas", icon: BookOpen, permission: PERMISSIONS.OFICINAS },
      { href: "/dashboard/turmas", label: "Turmas", icon: GraduationCap, permission: PERMISSIONS.TURMAS },
      { href: "/dashboard/presenca", label: "Presença", icon: ClipboardCheck, permission: PERMISSIONS.PRESENCA },
      { href: "/dashboard/equipe", label: "Equipe", icon: UserCog, permission: PERMISSIONS.EQUIPE },
    ],
  },
  {
    group: "Pedagógico",
    items: [
      { href: "/dashboard/plano-aula", label: "Aulas", icon: BookOpen, permission: PERMISSIONS.PLANO_AULA },
      { href: "/dashboard/calendario", label: "Calendário", icon: Calendar, permission: PERMISSIONS.CALENDARIO },
      { href: "/dashboard/pdis", label: "PDIs", icon: Brain, permission: PERMISSIONS.PDIS },
    ],
  },
  {
    group: "Relatórios",
    items: [{ href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart3, permission: PERMISSIONS.RELATORIOS }],
  },
]

const bottomMenuItems: NavItem[] = [
  // Configurações é autoatendimento (perfil + senha) - visível a todos os perfis logados.
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
  { href: "/dashboard/ajuda", label: "Ajuda", icon: HelpCircle },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile()
  // O "recolhido" (só ícones) vale apenas no desktop. No mobile o menu abre sempre EXPANDIDO,
  // com os nomes das funções e o logo no topo - senão o drawer herda o estado recolhido e some tudo.
  const displayCollapsed = collapsed && !isMobile

  const role = user?.role

  const canSee = (item: NavItem) => {
    if (!user) return false
    if (item.roles && (!role || !item.roles.includes(role))) return false
    if (item.permission && !hasPermission(user, item.permission)) return false
    return true
  }

  const visibleMenuItems = menuItems
    .map((group) => ({
      ...group,
      items: group.items.filter(canSee),
    }))
    .filter((group) => group.items.length > 0)

  const visibleBottomItems = bottomMenuItems.filter(canSee)

  // Persistir estado do menu
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved) setCollapsed(JSON.parse(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed))
    window.dispatchEvent(new CustomEvent('sidebar-collapsed', { detail: collapsed }))
  }, [collapsed])

  const handleLogout = () => {
    logout()
    router.replace("/")
  }

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const isActive = pathname === href

    const linkContent = (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          displayCollapsed ? "justify-center" : "",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-sidebar-primary-foreground")} />
        {!displayCollapsed && <span className="truncate">{label}</span>}
      </Link>
    )

    if (displayCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return linkContent
  }

  return (
    <TooltipProvider>
      {/* Botão flutuante SÓ para abrir (hambúrguer). Fechar é pelo X dentro do header do menu,
          para o X não ficar sobreposto ao logo. */}
      {!mobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 md:hidden bg-sidebar text-sidebar-foreground shadow-md"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 md:translate-x-0 flex flex-col",
          displayCollapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center border-b border-sidebar-border transition-all duration-300",
            displayCollapsed ? "justify-center p-3" : "justify-between p-4",
          )}
        >
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="Ir para o início (Dashboard)"
            className={cn(
              "flex items-center gap-3 overflow-hidden rounded-lg transition-opacity hover:opacity-80",
              displayCollapsed && "justify-center",
            )}
          >
            <Image
              src="/logo.png"
              alt="Projeto Anjos Inocentes"
              width={48}
              height={48}
              className="object-contain flex-shrink-0"
              style={{ width: displayCollapsed ? 40 : 48, height: 'auto' }}
            />
            {!displayCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sidebar-foreground text-sm truncate">
                  Anjos Inocentes
                </span>
                <span className="text-xs text-muted-foreground truncate">Sistema de Gestão</span>
              </div>
            )}
          </Link>

          {/* Fechar - só no mobile (à direita, sem cobrir o logo) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 flex-shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Collapse button - Desktop only */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden md:flex h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed && "absolute -right-3 top-6 bg-sidebar border border-sidebar-border shadow-md rounded-full",
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {visibleMenuItems.map((group) => (
            <div key={group.group}>
              {!displayCollapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.group}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}

          {/* Conta: Configurações, Ajuda e Sair agora rolam junto com o menu, em vez de ficarem
              presos (e cortados) num rodapé fixo quando a lista é longa. */}
          <div className="pt-3 mt-1 border-t border-sidebar-border">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Conta
              </h3>
            )}
            <div className="space-y-1">
              {visibleBottomItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}

              {/* Logout */}
              {displayCollapsed ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    Sair
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sair</span>
                </button>
              )}
            </div>
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  )
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved) setCollapsed(JSON.parse(saved))

    const handleStorage = () => {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved) setCollapsed(JSON.parse(saved))
    }

    window.addEventListener('storage', handleStorage)

    // Custom event for same-tab updates
    const handleCustom = (e: CustomEvent) => setCollapsed(e.detail)
    window.addEventListener('sidebar-collapsed' as any, handleCustom as any)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('sidebar-collapsed' as any, handleCustom as any)
    }
  }, [])

  return collapsed
}
