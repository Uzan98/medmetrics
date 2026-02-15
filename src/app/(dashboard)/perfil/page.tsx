'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui'
import {
    User,
    Mail,
    Calendar,
    Target,
    CheckCircle2,
    TrendingUp,
    Clock,
    BookOpen,
    Loader2,
    Lock,
    LogOut,
    Trash2,
    AlertTriangle,

} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface UserStats {
    totalQuestions: number
    totalCorrect: number
    totalDays: number
    avgQuestionsPerDay: number
    bestDiscipline: string | null
    worstDiscipline: string | null
    totalTime: number
    memberSince: string
}

export default function PerfilPage() {
    const [user, setUser] = useState<{ email: string; created_at: string } | null>(null)
    const [stats, setStats] = useState<UserStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [showPasswordForm, setShowPasswordForm] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [passwordSuccess, setPasswordSuccess] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        loadProfile()
    }, [])

    async function loadProfile() {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) return

            setUser({
                email: authUser.email || '',
                created_at: authUser.created_at,
            })

            // Load stats
            const { data: logs } = await supabase
                .from('question_logs')
                .select(`
                    date,
                    questions_done,
                    correct_answers,
                    time_minutes,
                    disciplines(name)
                `)
                .eq('user_id', authUser.id)

            if (logs) {
                const totalQuestions = logs.reduce((sum, log) => sum + log.questions_done, 0)
                const totalCorrect = logs.reduce((sum, log) => sum + log.correct_answers, 0)
                const totalTime = logs.reduce((sum, log) => sum + (log.time_minutes || 0), 0)
                const uniqueDays = new Set(logs.map(log => log.date)).size

                // Calculate discipline stats
                const discStats: { [key: string]: { questions: number; correct: number } } = {}
                logs.forEach(log => {
                    const disc = log.disciplines as { name: string } | null
                    if (disc) {
                        if (!discStats[disc.name]) {
                            discStats[disc.name] = { questions: 0, correct: 0 }
                        }
                        discStats[disc.name].questions += log.questions_done
                        discStats[disc.name].correct += log.correct_answers
                    }
                })

                const discArray = Object.entries(discStats)
                    .map(([name, data]) => ({
                        name,
                        accuracy: data.questions > 0 ? (data.correct / data.questions) * 100 : 0,
                    }))
                    .filter(d => d.accuracy > 0)
                    .sort((a, b) => b.accuracy - a.accuracy)

                setStats({
                    totalQuestions,
                    totalCorrect,
                    totalDays: uniqueDays,
                    avgQuestionsPerDay: uniqueDays > 0 ? Math.round(totalQuestions / uniqueDays) : 0,
                    bestDiscipline: discArray.length > 0 ? discArray[0].name : null,
                    worstDiscipline: discArray.length > 0 ? discArray[discArray.length - 1].name : null,
                    totalTime,
                    memberSince: authUser.created_at,
                })
            }
        } catch (error) {
            console.error('Error loading profile:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handlePasswordChange(e: React.FormEvent) {
        e.preventDefault()
        setPasswordError(null)
        setPasswordSuccess(false)

        if (newPassword.length < 6) {
            setPasswordError('A senha deve ter pelo menos 6 caracteres')
            return
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('As senhas não coincidem')
            return
        }

        setPasswordLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            })

            if (error) throw error

            setPasswordSuccess(true)
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => {
                setShowPasswordForm(false)
                setPasswordSuccess(false)
            }, 2000)
        } catch (error) {
            setPasswordError('Erro ao alterar senha. Tente novamente.')
        } finally {
            setPasswordLoading(false)
        }
    }

    async function handleLogout() {
        setLoggingOut(true)
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Reset Data Logic
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [resetting, setResetting] = useState(false)

    async function handleResetData() {
        setResetting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Delete from all tables related to user progress
            await Promise.all([
                supabase.from('question_logs').delete().eq('user_id', user.id),
                supabase.from('user_goals').delete().eq('user_id', user.id),
                supabase.from('study_schedules').delete().eq('user_id', user.id)
            ])

            // Clear local stats
            setStats({
                totalQuestions: 0,
                totalCorrect: 0,
                totalDays: 0,
                avgQuestionsPerDay: 0,
                bestDiscipline: null,
                worstDiscipline: null,
                totalTime: 0,
                memberSince: user.created_at
            })

            setShowResetConfirm(false)
            toast.success('Sua conta foi resetada com sucesso.')
        } catch (error) {
            console.error('Error resetting data:', error)
            toast.error('Erro ao resetar dados. Tente novamente.')
        } finally {
            setResetting(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40 rounded-2xl" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
                <p className="text-zinc-400">Gerencie sua conta e veja suas estatísticas</p>
            </div>

            {/* User Info Card */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl shadow-black/20">
                <div className="flex flex-col sm:flex-row sm:items-center gap-8">
                    {/* Avatar */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                            <span className="text-4xl font-bold text-white">
                                {user?.email?.[0].toUpperCase() || <User className="w-10 h-10" />}
                            </span>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white">
                                {user?.email?.split('@')[0]}
                            </h2>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                                Pro
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 text-zinc-400">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span>{user?.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span className="text-sm">
                                    Membro desde {user?.created_at ? format(new Date(user.created_at), "MMMM 'de' yyyy", { locale: ptBR }) : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:items-end gap-3">
                        <button
                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                            className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 text-zinc-200 hover:text-white group"
                        >
                            <Lock className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                            Alterar Senha
                        </button>
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="w-full sm:w-auto px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                        >
                            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                            Sair da Conta
                        </button>
                    </div>
                </div>

                {/* Password Form */}
                {showPasswordForm && (
                    <form onSubmit={handlePasswordChange} className="mt-8 pt-6 border-t border-white/5 animate-in slide-in-from-top-4 fade-in">
                        <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-indigo-400" />
                            Nova Senha
                        </h3>

                        {passwordError && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {passwordError}
                            </div>
                        )}

                        {passwordSuccess && (
                            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Senha alterada com sucesso!
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Nova senha</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-zinc-600"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Confirmar senha</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-zinc-600"
                                    placeholder="Repita a senha"
                                    required
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPasswordForm(false)}
                                className="px-5 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Salvar Nova Senha
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                                <Target className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-sm font-medium text-zinc-400">Total</span>
                        </div>
                        <p className="text-3xl font-bold text-white tracking-tight">{stats.totalQuestions.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-zinc-500 mt-1">questões realizadas</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-sm font-medium text-zinc-400">Acurácia</span>
                        </div>
                        <p className={`text-3xl font-bold tracking-tight ${(stats.totalQuestions > 0 ? (stats.totalCorrect / stats.totalQuestions) * 100 : 0) >= 70 ? 'text-emerald-400' : 'text-white'}`}>
                            {stats.totalQuestions > 0
                                ? ((stats.totalCorrect / stats.totalQuestions) * 100).toFixed(1)
                                : 0}%
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">taxa de acerto global</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                                <Calendar className="w-5 h-5 text-purple-400" />
                            </div>
                            <span className="text-sm font-medium text-zinc-400">Dias</span>
                        </div>
                        <p className="text-3xl font-bold text-white tracking-tight">{stats.totalDays}</p>
                        <p className="text-xs text-zinc-500 mt-1">dias estudados</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/20 group-hover:scale-110 transition-transform duration-300">
                                <TrendingUp className="w-5 h-5 text-amber-400" />
                            </div>
                            <span className="text-sm font-medium text-zinc-400">Ritmo</span>
                        </div>
                        <p className="text-3xl font-bold text-white tracking-tight">{stats.avgQuestionsPerDay}</p>
                        <p className="text-xs text-zinc-500 mt-1">questões / dia</p>
                    </div>
                </div>
            )}

            {/* Performance Highlights */}
            {stats && (stats.bestDiscipline || stats.worstDiscipline) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.bestDiscipline && (
                        <div className="relative bg-emerald-500/5 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20 overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                            <div className="relative flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/30">
                                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Ponto Forte</p>
                                    <p className="text-xl font-bold text-white mt-0.5">{stats.bestDiscipline}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {stats.worstDiscipline && stats.worstDiscipline !== stats.bestDiscipline && (
                        <div className="relative bg-orange-500/5 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/20 overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-orange-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                            <div className="relative flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0 ring-1 ring-orange-500/30">
                                    <BookOpen className="w-6 h-6 text-orange-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Foco de Melhoria</p>
                                    <p className="text-xl font-bold text-white mt-0.5">{stats.worstDiscipline}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Time Stats */}
            {stats && stats.totalTime > 0 && (
                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                        <Clock className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Dedicação Total</p>
                        <p className="text-2xl font-bold text-white mt-0.5">
                            {Math.floor(stats.totalTime / 60)}h {stats.totalTime % 60}min
                        </p>
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-6 backdrop-blur-sm mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 ring-1 ring-red-500/20">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-500">Zona de Perigo</h3>
                            <p className="text-sm text-red-400/60 font-medium">Esta ação apagará todo o seu progresso e não poderá ser desfeita.</p>
                        </div>
                    </div>

                    {!showResetConfirm ? (
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-bold transition-all border border-red-500/20 hover:border-red-500/40"
                        >
                            Resetar Todos os Dados
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-right-4 bg-red-500/10 p-2 rounded-xl border border-red-500/20">
                            <span className="text-sm font-bold text-red-400 px-2">Tem certeza absoluta?</span>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="flex-1 sm:flex-none px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-lg text-xs hover:bg-zinc-700 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleResetData}
                                    disabled={resetting}
                                    className="flex-1 sm:flex-none px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                                >
                                    {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                                    SIM, APAGAR
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
