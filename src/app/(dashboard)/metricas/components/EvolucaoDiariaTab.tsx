'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { TrendingUp, Calendar as CalendarIcon } from 'lucide-react'
import { format, subDays, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns'
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
    Legend
} from 'recharts'

interface DailyStats {
    date: string
    displayDate: string
    questions: number
    correct: number
    accuracy: number
}

export default function EvolucaoDiariaTab() {
    const [stats, setStats] = useState<DailyStats[]>([])
    const [loading, setLoading] = useState(true)
    const [daysRange, setDaysRange] = useState(30)
    const supabase = createClient()

    useEffect(() => {
        loadStats()
    }, [daysRange])

    async function loadStats() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const today = new Date()
            const startDate = subDays(today, daysRange - 1)
            const startDateStr = format(startDate, 'yyyy-MM-dd')

            // 1. Fetch Question Logs
            const logsPromise = supabase
                .from('question_logs')
                .select('date, questions_done, correct_answers')
                .eq('user_id', user.id)
                .gte('date', startDateStr)
                .lte('date', format(today, 'yyyy-MM-dd'))

            // 2. Fetch Exam Scores
            const examsPromise = supabase
                .from('exam_scores')
                .select(`
                    questions_total,
                    questions_correct,
                    exams!inner(date, user_id)
                `)
                .eq('exams.user_id', user.id)
                .gte('exams.date', startDateStr)
                .lte('exams.date', format(today, 'yyyy-MM-dd'))

            const [logsRes, examsRes] = await Promise.all([logsPromise, examsPromise])

            const logs = logsRes.data || []
            const examScores = examsRes.data || []

            // Generate all days in interval to ensure separate data points (even empty ones)
            const interval = eachDayOfInterval({ start: startDate, end: today })

            const dailyData = interval.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd')
                let questions = 0
                let correct = 0

                // Sum logs for this day
                logs.filter(l => l.date === dayStr).forEach(l => {
                    questions += l.questions_done
                    correct += l.correct_answers
                })

                // Sum exams for this day
                examScores.filter(s => (s.exams as any).date === dayStr).forEach(s => {
                    questions += s.questions_total
                    correct += s.questions_correct
                })

                return {
                    date: dayStr,
                    displayDate: format(day, 'dd/MM', { locale: ptBR }),
                    questions,
                    correct,
                    accuracy: questions > 0 ? (correct / questions) * 100 : 0
                }
            })

            setStats(dailyData)
        } catch (error) {
            console.error('Error loading daily stats:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        )
    }

    // Filter out empty days from the *start* if desired, or keep them to show gaps.
    // Usually seeing gaps is good for consistency tracking.
    // If TOTAL questions in range is 0, show empty state.
    const hasData = stats.some(s => s.questions > 0)

    if (!hasData) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={TrendingUp}
                    title="Sem dados recentes"
                    description="Registre questões para visualizar sua evolução diária."
                />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-white">Evolução Diária</h3>
                    <p className="text-sm text-slate-400">Desempenho dia a dia</p>
                </div>

                <select
                    value={daysRange}
                    onChange={(e) => setDaysRange(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value={7}>Últimos 7 dias</option>
                    <option value={15}>Últimos 15 dias</option>
                    <option value={30}>Últimos 30 dias</option>
                    <option value={60}>Últimos 60 dias</option>
                </select>
            </div>

            {/* Questions Volume Chart */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-400" />
                    Volume de Questões
                </h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                            <XAxis
                                dataKey="displayDate"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: any) => [value, 'Questões']}
                                labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                            />
                            <Bar
                                dataKey="questions"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                                name="Questões"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Accuracy Trend Chart */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Tendência de Acertos
                </h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats}>
                            <defs>
                                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                            <XAxis
                                dataKey="displayDate"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                unit="%"
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: any) => [`${value.toFixed(1)}%`, 'Acurácia']}
                                labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="accuracy"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorAccuracy)"
                                name="Acurácia"
                                connectNulls
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
