'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui'
import { Target, Save, Loader2, CheckCircle2, Download, TrendingUp, AlertCircle, Edit2 } from 'lucide-react'
import { getMonthName, cn } from '@/lib/utils'
import type { UserGoal } from '@/types/database'

export default function MetasPage() {
    const [goals, setGoals] = useState<UserGoal[]>([])
    const [monthlyStats, setMonthlyStats] = useState<{ [key: number]: number }>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<number | null | 'global'>(null)
    const [success, setSuccess] = useState<number | null | 'global'>(null)
    const [targets, setTargets] = useState<{ [key: number]: string }>({})
    const [exporting, setExporting] = useState(false)
    const [editing, setEditing] = useState<number | null>(null)

    // Global Default Goal State
    const [globalTarget, setGlobalTarget] = useState('')
    const [showGlobalInput, setShowGlobalInput] = useState(false)
    const [totalValidQuestions, setTotalValidQuestions] = useState(0)

    // Pace stats
    const [globalPace, setGlobalPace] = useState(0)

    const supabase = createClient()
    const currentYear = new Date().getFullYear()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [goalsRes, logsRes, allLogsRes] = await Promise.all([
                supabase
                    .from('user_goals')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('year', currentYear),
                supabase
                    .from('question_logs')
                    .select('date, questions_done')
                    .eq('user_id', user.id)
                    .gte('date', `${currentYear}-01-01`)
                    .lte('date', `${currentYear}-12-31`),
                supabase
                    .from('question_logs')
                    .select('questions_done')
                    .eq('user_id', user.id)
            ])

            if (goalsRes.data) {
                setGoals(goalsRes.data)
                const initialTargets: { [key: number]: string } = {}
                goalsRes.data.forEach((g) => {
                    initialTargets[g.month] = String(g.target_questions)
                })
                setTargets(initialTargets)
            }

            if (logsRes.data) {
                const stats: { [key: number]: number } = {}
                let yearTotal = 0
                logsRes.data.forEach((log) => {
                    const month = new Date(log.date).getMonth() + 1
                    stats[month] = (stats[month] || 0) + log.questions_done
                    yearTotal += log.questions_done
                })
                setMonthlyStats(stats)

                // Calculate rough daily pace for year (simplified)
                const dayOfYear = Math.floor((new Date().getTime() - new Date(currentYear, 0, 0).getTime()) / 1000 / 60 / 60 / 24)
                setGlobalPace(dayOfYear > 0 ? Math.round(yearTotal / dayOfYear) : 0)
            }

            if (allLogsRes.data) {
                const total = allLogsRes.data.reduce((acc, curr) => acc + curr.questions_done, 0)
                setTotalValidQuestions(total)
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function saveGoal(month: number) {
        const target = targets[month]
        if (!target || Number(target) <= 0) return

        setSaving(month)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const existingGoal = goals.find((g) => g.month === month)

            if (existingGoal) {
                await supabase
                    .from('user_goals')
                    .update({ target_questions: Number(target) })
                    .eq('id', existingGoal.id)
            } else {
                await supabase.from('user_goals').insert({
                    user_id: user.id,
                    month,
                    year: currentYear,
                    target_questions: Number(target),
                })
            }

            await loadData()
            setSuccess(month)
            setEditing(null)
            setTimeout(() => setSuccess(null), 2000)
        } catch (error) {
            console.error('Error saving goal:', error)
        } finally {
            setSaving(null)
        }
    }

    async function saveGlobalGoal() {
        if (!globalTarget || Number(globalTarget) <= 0) return

        setSaving('global')
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const updates = Array.from({ length: 12 }, (_, i) => ({
                user_id: user.id,
                month: i + 1,
                year: currentYear,
                target_questions: Number(globalTarget)
            }))

            const { error } = await supabase
                .from('user_goals')
                .upsert(
                    updates,
                    { onConflict: 'user_id,month,year' }
                )

            if (error) throw error

            await loadData()
            setSuccess('global')
            setShowGlobalInput(false)
            setGlobalTarget('')
            setTimeout(() => setSuccess(null), 2000)
        } catch (error) {
            console.error('Error saving global defaults:', error)
        } finally {
            setSaving(null)
        }
    }

    async function exportCSV() {
        setExporting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: logs } = await supabase
                .from('question_logs')
                .select(`
          date,
          questions_done,
          correct_answers,
          source,
          time_minutes,
          notes,
          disciplines(name),
          subdisciplines(name),
          topics(name)
        `)
                .eq('user_id', user.id)
                .order('date', { ascending: false })

            if (!logs) return

            const headers = [
                'Data', 'Disciplina', 'Subdisciplina', 'Assunto', 'Fonte', 'Questões', 'Acertos', 'Erros', 'Taxa (%)', 'Tempo (min)', 'Observações'
            ]

            const rows = logs.map((log) => {
                const discipline = (log.disciplines as { name: string } | null)?.name || ''
                const subdiscipline = (log.subdisciplines as { name: string } | null)?.name || ''
                const topic = (log.topics as { name: string } | null)?.name || ''
                const errors = log.questions_done - log.correct_answers
                const accuracy = log.questions_done > 0
                    ? ((log.correct_answers / log.questions_done) * 100).toFixed(1)
                    : '0'

                return [
                    log.date, discipline, subdiscipline, topic, log.source || '',
                    log.questions_done, log.correct_answers, errors, accuracy,
                    log.time_minutes || '', (log.notes || '').replace(/"/g, '""')
                ]
            })

            const csvContent = [
                headers.join(','),
                ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
            ].join('\n')

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `medmetrics_${currentYear}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error exporting CSV:', error)
        } finally {
            setExporting(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(12)].map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-2xl" />
                    ))}
                </div>
            </div>
        )
    }

    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const currentMonth = new Date().getMonth() + 1

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {/* Minimal Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Metas {currentYear}</h1>
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Target className="w-4 h-4 text-purple-400" />
                            <span>Total Geral: <strong className="text-white ml-1">{totalValidQuestions.toLocaleString()}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span>Ritmo Anual: <strong className="text-white ml-1">~{globalPace}/dia</strong></span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {showGlobalInput ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-10 fade-in duration-300">
                            <input
                                type="number"
                                placeholder="Meta Padrão"
                                value={globalTarget}
                                onChange={(e) => setGlobalTarget(e.target.value)}
                                className="w-32 px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-sm text-white focus:border-indigo-500 outline-none transition-all"
                                autoFocus
                            />
                            <button
                                onClick={saveGlobalGoal}
                                disabled={saving === 'global' || !globalTarget}
                                className="p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
                            >
                                {saving === 'global' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setShowGlobalInput(false)}
                                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                <AlertCircle className="w-4 h-4 rotate-45" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowGlobalInput(true)}
                            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            Definir Padrão Global
                        </button>
                    )}

                    <div className="h-6 w-px bg-zinc-800 mx-2" />

                    <button
                        onClick={exportCSV}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all text-sm font-medium disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="hidden sm:inline">CSV</span>
                    </button>
                </div>
            </div>

            {/* Compact Grid with Dynamic Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {months.map((month) => {
                    const goal = goals.find((g) => g.month === month)
                    const current = monthlyStats[month] || 0
                    const target = goal?.target_questions || 0
                    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0

                    const isEditing = editing === month
                    const isCurrentMonth = month === currentMonth

                    // Dynamic Colors based on Progress
                    let accentColor = "indigo" // Default
                    if (target > 0) {
                        if (percentage >= 100) accentColor = "green"
                        else if (percentage >= 70) accentColor = "indigo"
                        else if (percentage >= 40) accentColor = "yellow"
                        else accentColor = "slate" // Low progress
                    }

                    // Pre-compute classes to avoid messy template literals
                    const colorClasses: Record<string, any> = {
                        green: {
                            border: "border-green-500/30 hover:border-green-500/50",
                            bg: "bg-green-950/20 hover:bg-green-900/30",
                            glow: "bg-green-500/20",
                            text: "text-green-300",
                            bar: "bg-gradient-to-r from-green-500 to-emerald-400",
                            ring: "#22c55e",
                            ringTrack: "rgba(34, 197, 94, 0.2)"
                        },
                        indigo: {
                            border: "border-indigo-500/30 hover:border-indigo-500/50",
                            bg: "bg-indigo-950/20 hover:bg-indigo-900/30",
                            glow: "bg-indigo-500/20",
                            text: "text-indigo-300",
                            bar: "bg-gradient-to-r from-indigo-500 to-purple-500",
                            ring: "#6366f1",
                            ringTrack: "rgba(99, 102, 241, 0.2)"
                        },
                        yellow: {
                            border: "border-yellow-500/30 hover:border-yellow-500/50",
                            bg: "bg-yellow-950/20 hover:bg-yellow-900/30",
                            glow: "bg-yellow-500/20",
                            text: "text-yellow-300",
                            bar: "bg-gradient-to-r from-yellow-500 to-orange-500",
                            ring: "#eab308",
                            ringTrack: "rgba(234, 179, 8, 0.2)"
                        },
                        slate: {
                            border: "border-zinc-700 hover:border-zinc-600",
                            bg: "bg-zinc-900/40 hover:bg-zinc-800/60",
                            glow: "bg-zinc-500/10",
                            text: "text-zinc-400",
                            bar: "bg-zinc-600",
                            ring: "#a1a1aa",
                            ringTrack: "rgba(148, 163, 184, 0.1)"
                        }
                    }

                    const theme = colorClasses[accentColor]

                    // Override for Current Month if it's not completed yet to make it stand out
                    const cardStyle = isCurrentMonth && percentage < 100
                        ? { ...theme, ...colorClasses.indigo, bg: "bg-zinc-900/80 ring-1 ring-indigo-500/30", glow: "bg-indigo-500/20" }
                        : theme

                    return (
                        <div
                            key={month}
                            className={cn(
                                "group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 flex flex-col justify-between h-32 backdrop-blur-sm",
                                cardStyle.border,
                                cardStyle.bg
                            )}
                        >
                            {/* Background Glow */}
                            {(isCurrentMonth || percentage >= 40) && (
                                <div className={cn(
                                    "absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full pointer-events-none transition-all duration-500",
                                    cardStyle.glow
                                )} />
                            )}

                            <div className="flex justify-between items-start z-10">
                                <div>
                                    <h3 className={cn(
                                        "font-medium mb-1 transition-colors",
                                        isCurrentMonth ? "text-white font-bold" : cardStyle.text
                                    )}>
                                        {getMonthName(month)}
                                    </h3>

                                    {isEditing ? (
                                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                            <input
                                                type="number"
                                                className="w-20 px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-indigo-500 outline-none"
                                                value={targets[month] || ''}
                                                onChange={(e) => setTargets({ ...targets, [month]: e.target.value })}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveGoal(month)
                                                    if (e.key === 'Escape') setEditing(null)
                                                }}
                                            />
                                            <button
                                                onClick={() => saveGoal(month)}
                                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded text-green-400"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-baseline gap-1 group/edit">
                                            <span className="text-2xl font-bold text-white tracking-tight">
                                                {current.toLocaleString()}
                                            </span>
                                            {target > 0 && (
                                                <span className="text-xs text-zinc-500 font-medium">
                                                    / {Number(target).toLocaleString()}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setTargets({ ...targets, [month]: String(target || '') })
                                                    setEditing(month)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-zinc-500 hover:text-white"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Modern SVG Circular Progress */}
                                {target > 0 && (
                                    <div className="relative w-12 h-12 flex-shrink-0">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                            {/* Track */}
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke={theme.ringTrack}
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                            />
                                            {/* Progress */}
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke={theme.ring}
                                                strokeWidth="3"
                                                strokeDasharray={`${Math.min(percentage, 100)}, 100`}
                                                className="transition-all duration-1000 ease-out"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                                            {percentage >= 100 ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : (
                                                `${percentage.toFixed(0)}%`
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Progress Bar - Only visible if target set */}
                            {target > 0 && (
                                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-auto">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-1000",
                                            theme.bar
                                        )}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            )}

                            {target === 0 && !isEditing && (
                                <div className="mt-auto text-xs text-zinc-600 italic">
                                    Defina uma meta para acompanhar
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
