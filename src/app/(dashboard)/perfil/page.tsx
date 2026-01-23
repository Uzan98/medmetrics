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
            alert('Sua conta foi resetada com sucesso.')
        } catch (error) {
            console.error('Error resetting data:', error)
            alert('Erro ao resetar dados. Tente novamente.')
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
                <p className="text-slate-400">Gerencie sua conta e veja suas estatísticas</p>
            </div>

            {/* User Info Card */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                        <User className="w-10 h-10 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Mail className="w-4 h-4 text-slate-500" />
                            <span className="text-white">{user?.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-400 text-sm">
                                Membro desde {user?.created_at ? format(new Date(user.created_at), "MMMM 'de' yyyy", { locale: ptBR }) : ''}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Lock className="w-4 h-4" />
                            Alterar Senha
                        </button>
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                            Sair
                        </button>
                    </div>
                </div>

                {/* Password Form */}
                {showPasswordForm && (
                    <form onSubmit={handlePasswordChange} className="mt-6 pt-6 border-t border-slate-700/50">
                        <h3 className="font-medium text-white mb-4">Alterar Senha</h3>

                        {passwordError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {passwordError}
                            </div>
                        )}

                        {passwordSuccess && (
                            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Senha alterada com sucesso!
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Nova senha</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Confirmar senha</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                                    placeholder="Repita a senha"
                                    required
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPasswordForm(false)}
                                className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-xl text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
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
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Target className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="text-sm text-slate-400">Total de Questões</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.totalQuestions.toLocaleString('pt-BR')}</p>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                            </div>
                            <span className="text-sm text-slate-400">Taxa de Acerto</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {stats.totalQuestions > 0
                                ? ((stats.totalCorrect / stats.totalQuestions) * 100).toFixed(1)
                                : 0}%
                        </p>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-purple-400" />
                            </div>
                            <span className="text-sm text-slate-400">Dias de Estudo</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.totalDays}</p>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-yellow-400" />
                            </div>
                            <span className="text-sm text-slate-400">Média/Dia</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.avgQuestionsPerDay}</p>
                    </div>
                </div>
            )}

            {/* Performance Highlights */}
            {stats && (stats.bestDiscipline || stats.worstDiscipline) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.bestDiscipline && (
                        <div className="bg-green-500/10 rounded-xl p-5 border border-green-500/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-green-400">Melhor Desempenho</p>
                                    <p className="text-lg font-semibold text-white">{stats.bestDiscipline}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {stats.worstDiscipline && stats.worstDiscipline !== stats.bestDiscipline && (
                        <div className="bg-orange-500/10 rounded-xl p-5 border border-orange-500/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-orange-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-orange-400">Foco de Melhoria</p>
                                    <p className="text-lg font-semibold text-white">{stats.worstDiscipline}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Time Stats */}
            {stats && stats.totalTime > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Tempo Total de Estudo</p>
                            <p className="text-lg font-semibold text-white">
                                {Math.floor(stats.totalTime / 60)}h {stats.totalTime % 60}min
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="bg-red-500/5 rounded-xl p-6 border border-red-500/20 mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                            <Trash2 className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-red-400">Zona de Perigo</h3>
                            <p className="text-sm text-red-400/70">Ações irreversíveis para sua conta</p>
                        </div>
                    </div>

                    {!showResetConfirm ? (
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-medium transition-colors border border-red-500/20"
                        >
                            Resetar Todos os Dados
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-right-4">
                            <span className="text-sm font-medium text-red-400">Tem certeza? Isso apagará TUDO.</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleResetData}
                                    disabled={resetting}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                                >
                                    {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                                    SIM, APAGAR TUDO
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
