'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    LayoutDashboard,
    ClipboardPlus,
    BookOpen,
    Layers,
    TrendingUp,
    Target,
    LogOut,
    Menu,
    X,
    History,
    CalendarCheck,
    User,
    CalendarDays,
    FileText
} from 'lucide-react'
import { useState, useEffect } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/registrar', label: 'Registrar Questões', icon: ClipboardPlus },
    { href: '/metricas', label: 'Métricas', icon: TrendingUp },
    { href: '/provas', label: 'Provas', icon: FileText },
    { href: '/revisoes', label: 'Revisões', icon: CalendarCheck },
    { href: '/historico', label: 'Histórico', icon: History },
    { href: '/caderno-de-erros', label: 'Flashcards', icon: Layers },
    { href: '/agenda', label: 'Agenda', icon: CalendarDays },
    { href: '/perfil', label: 'Meu Perfil', icon: User },
]

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [user, setUser] = useState<SupabaseUser | null>(null)
    const supabase = createClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
    }, [supabase.auth])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black flex text-zinc-100 font-sans selection:bg-indigo-500/30">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } border-r border-white/5 bg-zinc-900/60 backdrop-blur-xl`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                                <div
                                    className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
                                >
                                    <BookOpen className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                                MedMetrics
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 space-y-1 py-4">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                                        ? 'bg-indigo-500/10 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)] border border-indigo-500/20'
                                        : 'text-zinc-400 hover:bg-white/5 hover:text-white hover:border-white/5 border border-transparent'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-indigo-400'}`} />
                                    <span className="font-medium">{item.label}</span>
                                    {isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-white/5 bg-black/20">
                        <div className="flex items-center gap-3 mb-3 px-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold ring-2 ring-white/10">
                                {user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {user?.user_metadata?.name || 'Usuário'}
                                </p>
                                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="font-medium text-sm">Sair da conta</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent">
                {/* Mobile header */}
                <header className="lg:hidden flex items-center justify-between p-4 bg-zinc-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
                        >
                            <BookOpen className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-white">MedMetrics</span>
                    </div>
                    <div className="w-10" />
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto p-4 lg:p-8 scroll-smooth">
                    {children}
                </main>
            </div>
        </div>
    )
}
