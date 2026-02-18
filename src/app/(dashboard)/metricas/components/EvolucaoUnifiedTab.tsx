'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { MonthlyEvolutionChart } from '@/components/charts'
import { TrendingUp, ArrowUp, ArrowDown, Minus, Calendar as CalendarIcon } from 'lucide-react'
import { getMonthName } from '@/lib/utils'
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts'

type Granularity = 'daily' | 'weekly' | 'monthly'

interface DataPoint {
    label: string
    questions: number
    correct: number
    accuracy: number
}

export default function EvolucaoUnifiedTab() {
    const [data, setData] = useState<DataPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [granularity, setGranularity] = useState<Granularity>('monthly')
    const [daysRange, setDaysRange] = useState(30)
    const supabase = createClient()
    const currentYear = new Date().getFullYear()

    useEffect(() => {
        loadData()
    }, [granularity, daysRange])

    async function loadData() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const today = new Date()
            let startDate: Date
            let dateFilter: string

            if (granularity === 'monthly') {
                startDate = new Date(currentYear, 0, 1)
                dateFilter = `${currentYear}-01-01`
            } else {
                startDate = subDays(today, daysRange - 1)
                dateFilter = format(startDate, 'yyyy-MM-dd')
            }

            const { data: logs } = await supabase
                .from('question_logs')
                .select('date, questions_done, correct_answers')
                .eq('user_id', user.id)
                .gte('date', dateFilter)
                .lte('date', format(today, 'yyyy-MM-dd'))

            if (!logs) {
                setData([])
                return
            }

            if (granularity === 'daily') {
                const interval = eachDayOfInterval({ start: startDate, end: today })
                const result = interval.map(day => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    let questions = 0
                    let correct = 0

                    logs.filter(l => l.date === dayStr).forEach(l => {
                        questions += l.questions_done
                        correct += l.correct_answers
                    })

                    return {
                        label: format(day, 'dd/MM', { locale: ptBR }),
                        questions,
                        correct,
                        accuracy: questions > 0 ? (correct / questions) * 100 : 0
                    }
                })
                setData(result)
            } else if (granularity === 'weekly') {
                // Aggregate by ISO week
                const weekMap: { [key: string]: { q: number; c: number; weekStart: Date } } = {}

                logs.forEach(log => {
                    const [y, m, d] = log.date.split('-').map(Number)
                    const logDate = new Date(y, m - 1, d, 12, 0, 0)
                    const ws = startOfWeek(logDate, { weekStartsOn: 1 })
                    const key = format(ws, 'yyyy-MM-dd')

                    if (!weekMap[key]) weekMap[key] = { q: 0, c: 0, weekStart: ws }
                    weekMap[key].q += log.questions_done
                    weekMap[key].c += log.correct_answers
                })

                const result = Object.values(weekMap)
                    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
                    .map(w => ({
                        label: `${format(w.weekStart, 'dd/MM', { locale: ptBR })}`,
                        questions: w.q,
                        correct: w.c,
                        accuracy: w.q > 0 ? (w.c / w.q) * 100 : 0
                    }))

                setData(result)
            } else {
                // Monthly
                const monthMap: { [key: number]: { q: number; c: number } } = {}

                logs.forEach(log => {
                    const [y, m] = log.date.split('-').map(Number)
                    if (!monthMap[m]) monthMap[m] = { q: 0, c: 0 }
                    monthMap[m].q += log.questions_done
                    monthMap[m].c += log.correct_answers
                })

                const result = Object.entries(monthMap)
                    .map(([month, d]) => ({
                        label: getMonthName(Number(month)).substring(0, 3),
                        questions: d.q,
                        correct: d.c,
                        accuracy: d.q > 0 ? (d.c / d.q) * 100 : 0
                    }))
                    .sort((a, b) => {
                        // Sort by month abbreviation -> reconstruct order
                        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                        return months.indexOf(a.label) - months.indexOf(b.label)
                    })

                setData(result)
            }
        } catch (error) {
            console.error('Error loading evolution data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Summary
    const totalQuestions = data.reduce((sum, d) => sum + d.questions, 0)
    const totalCorrect = data.reduce((sum, d) => sum + d.correct, 0)
    const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
    const activePeriodsCount = data.filter(d => d.questions > 0).length
    const avgPerPeriod = activePeriodsCount > 0 ? Math.round(totalQuestions / activePeriodsCount) : 0

    const periodLabel = granularity === 'daily' ? 'dia' : granularity === 'weekly' ? 'semana' : 'mês'

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        )
    }

    const hasData = data.some(d => d.questions > 0)

    if (!hasData) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={TrendingUp}
                    title="Sem dados de evolução"
                    description="Registre questões para ver sua evolução ao longo do tempo."
                />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Evolução</h3>
                    <p className="text-sm text-zinc-400">
                        {granularity === 'monthly' ? `Progresso ao longo de ${currentYear}` :
                            `Últimos ${daysRange} dias`}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Granularity toggle */}
                    <div className="flex bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-700/50">
                        {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
                            <button
                                key={g}
                                onClick={() => setGranularity(g)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${granularity === g
                                        ? 'bg-indigo-500 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                {g === 'daily' ? 'Diário' : g === 'weekly' ? 'Semanal' : 'Mensal'}
                            </button>
                        ))}
                    </div>

                    {/* Days range (only for daily/weekly) */}
                    {granularity !== 'monthly' && (
                        <select
                            value={daysRange}
                            onChange={(e) => setDaysRange(Number(e.target.value))}
                            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value={7}>7 dias</option>
                            <option value={15}>15 dias</option>
                            <option value={30}>30 dias</option>
                            <option value={60}>60 dias</option>
                            <option value={90}>90 dias</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <p className="text-xs text-zinc-400 mb-1">Total</p>
                    <p className="text-xl font-bold text-white">{totalQuestions.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-zinc-500">questões</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <p className="text-xs text-zinc-400 mb-1">Média por {periodLabel}</p>
                    <p className="text-xl font-bold text-white">{avgPerPeriod.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-zinc-500">questões/{periodLabel}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <p className="text-xs text-zinc-400 mb-1">Aproveitamento Geral</p>
                    <AccuracyBadge accuracy={overallAccuracy} size="lg" />
                </div>
            </div>

            {/* Volume chart */}
            <div className="bg-zinc-800/50 rounded-2xl p-4 sm:p-6 border border-zinc-700/50">
                <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-400" />
                    Volume de Questões
                </h3>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#a1a1aa"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                interval={granularity === 'daily' && daysRange > 15 ? Math.floor(daysRange / 10) : 0}
                            />
                            <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: '#27272a', opacity: 0.2 }}
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                labelStyle={{ color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                                formatter={(value: any) => [value, 'Questões']}
                            />
                            <Bar dataKey="questions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Questões" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Accuracy trend chart */}
            <div className="bg-zinc-800/50 rounded-2xl p-4 sm:p-6 border border-zinc-700/50">
                <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Tendência de Acertos
                </h3>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorAccuracyEvol" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#a1a1aa"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                interval={granularity === 'daily' && daysRange > 15 ? Math.floor(daysRange / 10) : 0}
                            />
                            <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Acurácia']}
                                labelStyle={{ color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="accuracy"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorAccuracyEvol)"
                                name="Acurácia"
                                connectNulls
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly table (only for monthly granularity) */}
            {granularity === 'monthly' && (
                <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-700/50">
                                    <th className="text-left py-3 px-5 text-xs font-medium text-zinc-400">Mês</th>
                                    <th className="text-right py-3 px-5 text-xs font-medium text-zinc-400">Questões</th>
                                    <th className="text-right py-3 px-5 text-xs font-medium text-zinc-400">Acertos</th>
                                    <th className="text-right py-3 px-5 text-xs font-medium text-zinc-400">Erros</th>
                                    <th className="text-right py-3 px-5 text-xs font-medium text-zinc-400">Taxa</th>
                                    <th className="text-center py-3 px-5 text-xs font-medium text-zinc-400">Tendência</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.filter(d => d.questions > 0).map((d, idx, arr) => {
                                    const prevAccuracy = idx > 0 ? arr[idx - 1].accuracy : null
                                    const errors = d.questions - d.correct
                                    return (
                                        <tr key={d.label} className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition-colors">
                                            <td className="py-3 px-5 font-medium text-white text-sm">{d.label}</td>
                                            <td className="py-3 px-5 text-right text-zinc-300 text-sm">{d.questions.toLocaleString('pt-BR')}</td>
                                            <td className="py-3 px-5 text-right text-green-400 text-sm">{d.correct.toLocaleString('pt-BR')}</td>
                                            <td className="py-3 px-5 text-right text-red-400 text-sm">{errors.toLocaleString('pt-BR')}</td>
                                            <td className="py-3 px-5 text-right"><AccuracyBadge accuracy={d.accuracy} /></td>
                                            <td className="py-3 px-5">
                                                <div className="flex items-center justify-center">
                                                    {prevAccuracy === null
                                                        ? <Minus className="w-4 h-4 text-zinc-400" />
                                                        : d.accuracy > prevAccuracy
                                                            ? <ArrowUp className="w-4 h-4 text-green-400" />
                                                            : d.accuracy < prevAccuracy
                                                                ? <ArrowDown className="w-4 h-4 text-red-400" />
                                                                : <Minus className="w-4 h-4 text-zinc-400" />
                                                    }
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
