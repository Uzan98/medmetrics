'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { ArrowLeft, TrendingUp, AlertCircle, Brain, Target, Compass, Flame, Zap } from 'lucide-react'
import Link from 'next/link'
import { addDays, format, startOfDay } from 'date-fns'

export default function FlashcardAnalyticsPage() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<{
        byDiscipline: any[]
        byType: any[]
        stabilityDist: any[]
        difficultyDist: any[]
        forecast: any[]
        retentionRate: number
        totalReviews: number
        trueRetention: number
        totalCards: number
        learningPhases: any[]
        currentStreak: number
        totalXp: number
    }>({
        byDiscipline: [],
        byType: [],
        stabilityDist: [],
        difficultyDist: [],
        forecast: [],
        retentionRate: 0,
        totalReviews: 0,
        trueRetention: 0,
        totalCards: 0,
        learningPhases: [],
        currentStreak: 0,
        totalXp: 0
    })

    const supabase = createClient()

    useEffect(() => {
        loadStats()
    }, [])

    async function loadStats() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch error entries for current distribution
            const { data: errorsData } = await supabase
                .from('error_notebook')
                .select(`
                    id,
                    error_type,
                    disciplines(name),
                    stability,
                    difficulty,
                    next_review_date,
                    state
                `)
                .eq('user_id', user.id)

            const errors = errorsData as any[]

            // Fetch user study stats
            const { data: userStats } = await supabase
                .from('user_study_stats')
                .select('current_streak, total_xp')
                .eq('user_id', user.id)
                .single()

            // Fetch review history for retention rate
            const { data: reviewsData } = await supabase
                .from('flashcard_reviews')
                .select('difficulty, reviewed_at')
                .eq('user_id', user.id)
                .order('reviewed_at', { ascending: false })
                .limit(1000)

            const reviews = reviewsData as any[]

            // Process By Discipline
            const discCount: Record<string, number> = {}
            errors?.forEach(e => {
                const name = e.disciplines?.name || 'Sem disciplina'
                discCount[name] = (discCount[name] || 0) + 1
            })
            const byDiscipline = Object.entries(discCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Process By Type
            const typeMap: Record<string, string> = {
                'knowledge_gap': 'Lacuna de Conhecimento',
                'interpretation': 'Interpretação',
                'distraction': 'Falta de Atenção',
                'reasoning': 'Raciocínio'
            }
            const typeCount: Record<string, number> = {}
            errors?.forEach(e => {
                const type = e.error_type ? typeMap[e.error_type] || e.error_type : 'Não classificado'
                typeCount[type] = (typeCount[type] || 0) + 1
            })
            const byType = Object.entries(typeCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Process Stability Distribution
            const stabilityBins = { '0-1d': 0, '2-7d': 0, '8-30d': 0, '1-3m': 0, '3m+': 0 }
            errors?.forEach((e: any) => {
                const s = e.stability || 0
                if (s <= 1) stabilityBins['0-1d']++
                else if (s <= 7) stabilityBins['2-7d']++
                else if (s <= 30) stabilityBins['8-30d']++
                else if (s <= 90) stabilityBins['1-3m']++
                else stabilityBins['3m+']++
            })
            const stabilityDist = Object.entries(stabilityBins).map(([name, value]) => ({ name, value }))

            // Process Difficulty Distribution
            const difficultyBins = Array(10).fill(0)
            errors?.forEach((e: any) => {
                const d = Math.min(Math.max(Math.ceil(e.difficulty || 0), 1), 10)
                difficultyBins[d - 1]++
            })
            const difficultyDist = difficultyBins.map((value, i) => ({ name: `${i + 1}`, value }))

            // Process Forecast (Next 30 days)
            const forecastMap: Record<string, number> = {}
            const today = startOfDay(new Date())
            const todayStr = format(today, 'yyyy-MM-dd')
            let overdue = 0

            // Initialize next 30 days
            for (let i = 0; i < 30; i++) {
                const date = format(addDays(today, i), 'yyyy-MM-dd')
                forecastMap[date] = 0
            }

            errors?.forEach((e: any) => {
                if (e.next_review_date) {
                    const dateStr = e.next_review_date
                    if (dateStr < todayStr) {
                        overdue++
                    } else if (forecastMap[dateStr] !== undefined) {
                        forecastMap[dateStr]++
                    }
                } else {
                    overdue++
                }
            })

            forecastMap[todayStr] += overdue

            const forecast = Object.entries(forecastMap)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, value]) => {
                    const splitDate = date.split('-')
                    let day = splitDate[2]
                    let month = splitDate[1]

                    return {
                        date: `${day}/${month}`,
                        fullDate: date,
                        value
                    }
                })

            // Process Learning Phases
            const phaseMap: Record<string, string> = {
                '0': 'Novos',
                '1': 'Em Aprendizado',
                '2': 'Revisão',
                '3': 'Reaprendizado'
            }
            const phaseCount: Record<string, number> = {}
            errors?.forEach(e => {
                const stateVal = e.state !== undefined && e.state !== null ? String(e.state) : '0'
                const stateName = phaseMap[stateVal] || 'Novos'
                phaseCount[stateName] = (phaseCount[stateName] || 0) + 1
            })
            const learningPhases = Object.entries(phaseCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Process Retention (Global)
            let correct = 0
            reviews?.forEach(r => {
                if (r.difficulty === 'easy' || r.difficulty === 'good' || r.difficulty === 'hard') correct++ // Account for good/easy/hard as successes conceptually
            })
            const retentionRate = reviews && reviews.length > 0
                ? (correct / reviews.length) * 100
                : 0

            // True Retention (Last 30 days)
            const thirtyDaysAgo = addDays(new Date(), -30)
            const recentReviews = reviews?.filter(r => r.reviewed_at && new Date(r.reviewed_at) > thirtyDaysAgo) || []
            let recentCorrect = 0
            recentReviews.forEach(r => {
                if (r.difficulty === 'easy' || r.difficulty === 'good' || r.difficulty === 'hard') recentCorrect++
            })
            const trueRetention = recentReviews.length > 0
                ? (recentCorrect / recentReviews.length) * 100
                : 0

            setStats({
                byDiscipline,
                byType,
                stabilityDist,
                difficultyDist,
                forecast,
                retentionRate,
                totalReviews: reviews?.length || 0,
                trueRetention,
                totalCards: errors?.length || 0,
                learningPhases,
                currentStreak: userStats?.current_streak || 0,
                totalXp: userStats?.total_xp || 0
            })

        } catch (error) {
            console.error('Error loading analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    const COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#6366f1']

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in pb-24">
            {/* ── Hero Header ── */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-950 via-zinc-900 to-purple-950 shadow-2xl">
                <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: 'radial-gradient(at 20% 30%, rgba(99,102,241,0.4) 0, transparent 50%), radial-gradient(at 80% 20%, rgba(168,85,247,0.3) 0, transparent 50%), radial-gradient(at 50% 80%, rgba(236,72,153,0.2) 0, transparent 50%)'
                }} />

                <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                                <Brain className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">Análise do Caderno de Erros</h1>
                                <p className="text-indigo-200/80 font-medium">Desempenho, retenção e perfil de revisões</p>
                            </div>
                        </div>
                    </div>

                    <Link
                        href="/caderno-de-erros"
                        className="group px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all border border-white/10 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] w-fit"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Voltar aos Flashcards
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <Target className="w-5 h-5 text-emerald-400" />
                                </div>
                                <span className="font-semibold text-zinc-400">Retenção (30d)</span>
                            </div>
                            <p className="text-3xl font-black text-white">
                                {stats.trueRetention.toFixed(1)}%
                            </p>
                            <p className="text-sm font-medium text-zinc-500 mt-1">Meta Ideal: 90%</p>
                        </div>

                        <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                    <TrendingUp className="w-5 h-5 text-blue-400" />
                                </div>
                                <span className="font-semibold text-zinc-400">Total de Revisões</span>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.totalReviews}</p>
                            <p className="text-sm font-medium text-zinc-500 mt-1">Cards respondidos</p>
                        </div>

                        <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-lg bg-rose-500/10">
                                    <AlertCircle className="w-5 h-5 text-rose-400" />
                                </div>
                                <span className="font-semibold text-zinc-400">Total Cards</span>
                            </div>
                            <p className="text-3xl font-black text-white">
                                {stats.totalCards}
                            </p>
                            <p className="text-sm font-medium text-zinc-500 mt-1">No acervo ativo</p>
                        </div>

                        <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-lg bg-purple-500/10">
                                    <Compass className="w-5 h-5 text-purple-400" />
                                </div>
                                <span className="font-semibold text-zinc-400">Top Disciplina</span>
                            </div>
                            <p className="text-xl font-bold text-white truncate leading-snug" title={stats.byDiscipline[0]?.name}>
                                {stats.byDiscipline[0]?.name || '-'}
                            </p>
                            <p className="text-sm font-medium text-zinc-500 mt-1">Mais frequente</p>
                        </div>

                        <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-lg bg-orange-500/10">
                                    <Flame className="w-5 h-5 text-orange-400" />
                                </div>
                                <span className="font-semibold text-zinc-400">Ofensiva</span>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.currentStreak}<span className="text-base font-medium text-zinc-500 ml-1">dias</span></p>
                            <p className="text-sm font-medium text-zinc-500 mt-1">Sequência atual</p>
                        </div>

                        <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-lg bg-yellow-500/10">
                                    <Zap className="w-5 h-5 text-yellow-400" />
                                </div>
                                <span className="font-semibold text-zinc-400">XP Acumulado</span>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.totalXp}</p>
                            <p className="text-sm font-medium text-zinc-500 mt-1">Sua experiência!</p>
                        </div>
                    </div>

                    {/* Forecast & Learning Phases */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Forecast Chart */}
                        <div className="xl:col-span-2 bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80 shadow-md">
                            <h3 className="text-xl font-bold text-white mb-2">Previsão de Revisões (Próximos 30 Dias)</h3>
                            <p className="text-zinc-400 font-medium mb-8">Acompanhe o volume diário de flashcards agendados para revisar. Planeje seus estudos!</p>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.forecast}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="date" stroke="#a1a1aa" fontSize={13} tickMargin={12} />
                                        <YAxis stroke="#a1a1aa" fontSize={13} />
                                        <Tooltip
                                            cursor={{ fill: '#27272a', opacity: 0.2 }}
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Cards Agendados">
                                            {stats.forecast.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#8b5cf6'} /> // Highlight today in green
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Learning Phases */}
                        <div className="xl:col-span-1 bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80 shadow-md">
                            <h3 className="text-xl font-bold text-white mb-2">Fases do Aprendizado</h3>
                            <p className="text-zinc-400 font-medium mb-8">Status atual do seu acervo</p>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.learningPhases}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {stats.learningPhases.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Stability & Difficulty */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80 shadow-md">
                            <h3 className="text-xl font-bold text-white mb-2">Estabilidade da Memória</h3>
                            <p className="text-zinc-400 font-medium mb-8">Por quanto tempo seguro você lembra dos cards (FSRS)</p>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.stabilityDist}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="name" stroke="#a1a1aa" fontSize={13} tickMargin={10} />
                                        <YAxis stroke="#a1a1aa" fontSize={13} />
                                        <Tooltip
                                            cursor={{ fill: '#27272a', opacity: 0.2 }}
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                                        />
                                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} name="Cards" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80 shadow-md">
                            <h3 className="text-xl font-bold text-white mb-2">Dificuldade dos Cards</h3>
                            <p className="text-zinc-400 font-medium mb-8">Intervalo de 1 (Muito Fácil) a 10 (Muito Difícil)</p>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.difficultyDist}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="name" stroke="#a1a1aa" fontSize={13} tickMargin={10} />
                                        <YAxis stroke="#a1a1aa" fontSize={13} />
                                        <Tooltip
                                            cursor={{ fill: '#27272a', opacity: 0.2 }}
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                                        />
                                        <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Cards" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80 shadow-md">
                            <h3 className="text-xl font-bold text-white mb-8">Distribuição por Disciplina</h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.byDiscipline}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {stats.byDiscipline.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80 shadow-md">
                            <h3 className="text-xl font-bold text-white mb-8">Distribuição por Tipo de Erro</h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.byType} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                        <XAxis type="number" stroke="#a1a1aa" />
                                        <YAxis dataKey="name" type="category" width={110} stroke="#a1a1aa" fontSize={13} />
                                        <Tooltip
                                            cursor={{ fill: '#27272a', opacity: 0.2 }}
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Ocorrências">
                                            {stats.byType.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
