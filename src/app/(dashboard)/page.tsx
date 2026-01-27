'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton, EmptyState, Speedometer } from '@/components/ui'
import {
    ClipboardList,
    Target,
    Plus,
    Stethoscope,
    Scissors,
    Baby,
    Heart,
    ShieldCheck,
    TrendingUp,
    TrendingDown,
    Clock,
    ChevronDown,
    CalendarCheck,
    Flame,
    Trophy,
    BookOpen,
    Filter,
    Minus,
} from 'lucide-react'
import Link from 'next/link'
import { getMonthName } from '@/lib/utils'
import { format, subDays, startOfMonth, endOfMonth, addDays, isToday, isPast, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Area,
    AreaChart,
} from 'recharts'
import { toast } from 'sonner'



const disciplineIcons: { [key: string]: any } = {
    'Clínica Médica': Stethoscope,
    'Cirurgia': Scissors,
    'Ginecologia e Obstetrícia': Baby,
    'Pediatria': Heart,
    'Medicina Preventiva': ShieldCheck,
}

const disciplineColors: { [key: string]: string } = {
    'Clínica Médica': '#3b82f6',
    'Cirurgia': '#f59e0b',
    'Ginecologia e Obstetrícia': '#ec4899',
    'Pediatria': '#10b981',
    'Medicina Preventiva': '#8b5cf6',
}

interface DashboardStats {
    totalQuestions: number
    totalCorrect: number
    overallAccuracy: number
    weekQuestions: number
    monthQuestions: number
    monthGoal: number | null
    dailyGoalNeeded: number
    daysRemaining: number
}

interface ChartData {
    name: string
    accuracy: number
    questions: number
}

interface DisciplineStats {
    name: string
    accuracy: number
    questions: number
}

interface SubdisciplineStats {
    name: string
    questions: number
    accuracy: number
    trend: 'up' | 'down' | 'neutral'
}

interface TimeData {
    name: string
    hours: number
}

interface PendingReview {
    id: string
    scheduled_date: string
    review_type: string
    disciplines: { name: string } | null
    subdisciplines: { name: string } | null
}

interface StreakData {
    current: number
    record: number
    lastStudyDate: string | null
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [monthlyAccuracy, setMonthlyAccuracy] = useState<ChartData[]>([])
    const [disciplineStats, setDisciplineStats] = useState<DisciplineStats[]>([])
    const [subdisciplineStats, setSubdisciplineStats] = useState<SubdisciplineStats[]>([])
    const [timeData, setTimeData] = useState<TimeData[]>([])
    const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
    const [streakData, setStreakData] = useState<StreakData>({ current: 0, record: 0, lastStudyDate: null })
    const [loading, setLoading] = useState(true)
    const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | '3m' | '6m' | 'year'>('year')
    const [disciplineFilter, setDisciplineFilter] = useState<string>('all')
    const [allDisciplines, setAllDisciplines] = useState<{ id: number, name: string }[]>([])
    const [showFilters, setShowFilters] = useState(false)

    // Empty State Goal Logic
    const [goalInput, setGoalInput] = useState('800')
    const [savingGoal, setSavingGoal] = useState(false)
    const [goalSaved, setGoalSaved] = useState(false)

    const supabase = createClient()

    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    useEffect(() => {
        loadDashboardData()
    }, [periodFilter, disciplineFilter])



    // ... existing code ...

    async function saveInitialGoal() {
        setSavingGoal(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('user_goals')
                .upsert({
                    user_id: user.id,
                    month: currentMonth,
                    year: currentYear,
                    target_questions: Number(goalInput)
                }, { onConflict: 'user_id, month, year' })

            if (error) throw error

            setGoalSaved(true)
            toast.success('Meta salva com sucesso!')
            setTimeout(() => setGoalSaved(false), 3000)

            // Reload data to update stats
            loadDashboardData()
        } catch (error) {
            console.error('Error saving goal:', error)
            toast.error('Erro ao salvar meta.')
        } finally {
            setSavingGoal(false)
        }
    }

    async function loadDashboardData() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Calculate date range based on filter
            const today = new Date()
            let startDate: Date
            switch (periodFilter) {
                case '7d':
                    startDate = subDays(today, 7)
                    break
                case '30d':
                    startDate = subDays(today, 30)
                    break
                case '3m':
                    startDate = subDays(today, 90)
                    break
                case '6m':
                    startDate = subDays(today, 180)
                    break
                case 'year':
                default:
                    startDate = new Date(currentYear, 0, 1)
            }

            // Get disciplines for filter dropdown
            const { data: disciplines } = await supabase
                .from('disciplines')
                .select('id, name')
                .order('name')
            setAllDisciplines(disciplines || [])

            // 1. Fetch Question Logs
            let queryLogs = supabase
                .from('question_logs')
                .select(`*, disciplines(id, name), subdisciplines(id, name)`)
                .eq('user_id', user.id)
                .gte('date', format(startDate, 'yyyy-MM-dd'))
                .order('date', { ascending: true })

            if (disciplineFilter !== 'all') {
                queryLogs = queryLogs.eq('discipline_id', Number(disciplineFilter))
            }

            // 2. Fetch Exams (flattened scores)
            let queryExams = supabase
                .from('exam_scores')
                .select(`
                    questions_total,
                    questions_correct,
                    discipline_id,
                    disciplines(id, name),
                    exams!inner(date, user_id)
                `)
                .eq('exams.user_id', user.id)
                .gte('exams.date', format(startDate, 'yyyy-MM-dd'))

            if (disciplineFilter !== 'all') {
                queryExams = queryExams.eq('discipline_id', Number(disciplineFilter))
            }

            const [logsRes, examsRes] = await Promise.all([queryLogs, queryExams])

            const logs = logsRes.data || []
            const titleExams = examsRes.data || []

            // 3. Unify Data
            // We convert everything to a standard format for calculation
            const safeParseDate = (dateStr: string) => {
                if (!dateStr) return new Date()
                if (dateStr.includes('T')) return new Date(dateStr)
                // Handle YYYY-MM-DD manually to avoid timezone shift
                const [y, m, d] = dateStr.split('-').map(Number)
                return new Date(y, m - 1, d, 12, 0, 0) // Midday to be safe
            }

            const unifiedData = [
                ...logs.map(l => ({
                    date: l.date,
                    parsedDate: safeParseDate(l.date),
                    questions: l.questions_done,
                    correct: l.correct_answers,
                    discipline: l.disciplines,
                    subdiscipline: l.subdisciplines,
                    type: 'log'
                })),
                ...titleExams.map(e => ({
                    date: (e.exams as any).date,
                    parsedDate: safeParseDate((e.exams as any).date),
                    questions: e.questions_total,
                    correct: e.questions_correct,
                    discipline: e.disciplines,
                    subdiscipline: null, // Exams don't track subdiscipline granularity in scores usually
                    type: 'exam'
                }))
            ].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())


            // Get current month goal
            const { data: goalData } = await supabase
                .from('user_goals')
                .select('target_questions')
                .eq('user_id', user.id)
                .eq('year', currentYear)
                .eq('month', currentMonth)
                .single()

            // Calculate stats
            const totalQuestions = unifiedData.reduce((sum, item) => sum + item.questions, 0)
            const totalCorrect = unifiedData.reduce((sum, item) => sum + item.correct, 0)
            const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0

            // Helper for date filtering
            const isWithin = (date: Date, start: Date, end: Date) => date >= start && date <= end

            // Week stats
            const weekStart = subDays(today, 7)
            const weekQuestions = unifiedData
                .filter(item => isWithin(item.parsedDate, weekStart, today))
                .reduce((sum, item) => sum + item.questions, 0)

            // Month stats
            const monthStart = startOfMonth(today)
            const monthEnd = endOfMonth(today)
            const monthQuestions = unifiedData
                .filter(item => isWithin(item.parsedDate, monthStart, monthEnd))
                .reduce((sum, item) => sum + item.questions, 0)

            // Calculate pace
            const daysInMonth = monthEnd.getDate()
            const currentDay = today.getDate()
            // Include today in the remaining time to hit the goal
            const daysRemaining = Math.max(1, daysInMonth - currentDay + 1)
            const monthGoal = goalData?.target_questions || 800
            const questionsRemaining = Math.max(0, monthGoal - monthQuestions)
            // Even if daysRemaining is 1, we divide correctly. If questionsRemaining is 0, dailyGoalNeeded is 0.
            const dailyGoalNeeded = questionsRemaining > 0 ? Math.ceil(questionsRemaining / daysRemaining) : 0

            setStats({
                totalQuestions,
                totalCorrect,
                overallAccuracy,
                weekQuestions,
                monthQuestions,
                monthGoal,
                dailyGoalNeeded,
                daysRemaining,
            })



            // Calculate streak (needs ALL logs + exams, not just filtered)
            // Separate query for streak to be accurate over ALL time
            const { data: allLogsDates } = await supabase
                .from('question_logs')
                .select('date')
                .eq('user_id', user.id)

            const { data: allExamsDates } = await supabase
                .from('exams')
                .select('date')
                .eq('user_id', user.id)

            const allActivityDates = [
                ...(allLogsDates || []).map(d => d.date),
                ...(allExamsDates || []).map(d => d.date)
            ]

            const streakCalculator = (dates: string[]) => {
                if (dates.length === 0) return { current: 0, record: 0, lastStudyDate: null }

                const uniqueDates = [...new Set(dates)].sort((a, b) =>
                    safeParseDate(b).getTime() - safeParseDate(a).getTime()
                )

                const todayStr = format(new Date(), 'yyyy-MM-dd')
                const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
                const lastStudyDate = uniqueDates[0]

                let current = 0
                if (lastStudyDate === todayStr || lastStudyDate === yesterdayStr) {
                    current = 1
                    let checkDate = lastStudyDate === todayStr ? subDays(new Date(), 1) : subDays(new Date(), 2)

                    for (let i = 1; i < uniqueDates.length; i++) {
                        const d = safeParseDate(uniqueDates[i])
                        // Compare YYYY-MM-DD strings to avoid confusion
                        if (format(d, 'yyyy-MM-dd') === format(checkDate, 'yyyy-MM-dd')) {
                            current++
                            checkDate = subDays(checkDate, 1)
                        } else if (d < checkDate) {
                            break
                        }
                    }
                }

                let max = 0
                let temp = 1
                // Calculate max streak
                // Sort Ascending
                const sortedAsc = [...uniqueDates].sort((a, b) =>
                    safeParseDate(a).getTime() - safeParseDate(b).getTime()
                )

                for (let i = 1; i < sortedAsc.length; i++) {
                    const prev = safeParseDate(sortedAsc[i - 1])
                    const curr = safeParseDate(sortedAsc[i])
                    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
                    if (diff === 1) temp++
                    else {
                        max = Math.max(max, temp)
                        temp = 1
                    }
                }
                max = Math.max(max, temp)

                return { current, record: max, lastStudyDate }
            }

            setStreakData(streakCalculator(allActivityDates))

            // Calculate monthly accuracy trend
            const monthlyStatsMap: { [key: number]: { questions: number; correct: number } } = {}
            unifiedData.forEach(item => {
                const month = item.parsedDate.getMonth() + 1
                if (!monthlyStatsMap[month]) monthlyStatsMap[month] = { questions: 0, correct: 0 }
                monthlyStatsMap[month].questions += item.questions
                monthlyStatsMap[month].correct += item.correct
            })

            const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
            const monthlyData: ChartData[] = months.map((name, i) => {
                const data = monthlyStatsMap[i + 1]
                return {
                    name,
                    questions: data?.questions || 0,
                    accuracy: data && data.questions > 0 ? (data.correct / data.questions) * 100 : 0,
                }
            })
            setMonthlyAccuracy(monthlyData)

            // Calculate discipline stats
            const discStatsMap: { [key: string]: { questions: number; correct: number } } = {}
            unifiedData.forEach(item => {
                if (!item.discipline) return
                const name = (item.discipline as any).name
                if (!discStatsMap[name]) discStatsMap[name] = { questions: 0, correct: 0 }
                discStatsMap[name].questions += item.questions
                discStatsMap[name].correct += item.correct
            })

            const disciplineDataArray = Object.entries(discStatsMap)
                .map(([name, data]) => ({
                    name,
                    accuracy: data.questions > 0 ? (data.correct / data.questions) * 100 : 0,
                    questions: data.questions,
                }))
                .sort((a, b) => b.accuracy - a.accuracy)
            setDisciplineStats(disciplineDataArray)

            // Calculate subdiscipline stats (Only from logs since exams don't have subdisciplines easy to map yet)
            // Or we can just use logging data for subdisciplines as before
            const subStats: { [key: string]: { questions: number; correct: number; recentQuestions: number; recentCorrect: number } } = {}
            const thirtyDaysAgo = subDays(today, 30)

            logs.forEach(log => {
                if (!log.subdisciplines) return
                const sub = log.subdisciplines as { id: number; name: string }
                const logDate = safeParseDate(log.date)

                if (!subStats[sub.name]) {
                    subStats[sub.name] = { questions: 0, correct: 0, recentQuestions: 0, recentCorrect: 0 }
                }
                subStats[sub.name].questions += log.questions_done
                subStats[sub.name].correct += log.correct_answers

                if (logDate >= thirtyDaysAgo) {
                    subStats[sub.name].recentQuestions += log.questions_done
                    subStats[sub.name].recentCorrect += log.correct_answers
                }
            })

            const subdisciplineData = Object.entries(subStats)
                .map(([name, data]) => {
                    const overallAccuracy = data.questions > 0 ? (data.correct / data.questions) * 100 : 0
                    const recentAccuracy = data.recentQuestions > 0 ? (data.recentCorrect / data.recentQuestions) * 100 : 0
                    let trend: 'up' | 'down' | 'neutral' = 'neutral'
                    if (data.recentQuestions >= 5) {
                        if (recentAccuracy > overallAccuracy + 2) trend = 'up'
                        else if (recentAccuracy < overallAccuracy - 2) trend = 'down'
                    }
                    return { name, questions: data.questions, accuracy: overallAccuracy, trend }
                })
                .sort((a, b) => b.questions - a.questions)
                .slice(0, 6)
            setSubdisciplineStats(subdisciplineData)

            // Calculate time data (from logs only as exams don't have time logged yet usually)
            const timeArr: TimeData[] = []
            for (let i = 14; i >= 0; i--) {
                const date = subDays(today, i)
                const dateStr = format(date, 'yyyy-MM-dd')
                const dayLogs = logs.filter(log => log.date === dateStr)
                const totalMinutes = dayLogs.reduce((sum, log) => sum + (log.time_minutes || 0), 0)
                timeArr.push({
                    name: format(date, 'dd', { locale: ptBR }),
                    hours: totalMinutes / 60,
                })
            }
            setTimeData(timeArr)

            // Load pending reviews (kept same)
            const { data: reviews } = await supabase
                .from('scheduled_reviews')
                .select(`id, scheduled_date, review_type, disciplines(name), subdisciplines(name)`)
                .eq('user_id', user.id)
                .eq('completed', false)
                .lte('scheduled_date', format(addDays(today, 7), 'yyyy-MM-dd'))
                .order('scheduled_date', { ascending: true })
                .limit(5)

            setPendingReviews((reviews as any) || [])

        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    // Função para converter % em escala qualitativa
    const getQualitativeLevel = (accuracy: number): number => {
        if (accuracy < 50) return 1 // Ruim
        if (accuracy < 65) return 2 // Regular  
        if (accuracy < 80) return 3 // Bom
        return 4 // Excelente
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-64 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            </div>
        )
    }

    if (!stats || stats.totalQuestions === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in">
                <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Card 1: Register First Questions */}
                    <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700/50 flex flex-col items-center text-center space-y-6 hover:bg-slate-800/80 transition-all group">
                        <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <ClipboardList className="w-10 h-10 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Primeiros Passos</h2>
                            <p className="text-slate-400">Comece registrando suas primeiras questões para desbloquear as métricas.</p>
                        </div>
                        <Link
                            href="/registrar"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                        >
                            <Plus className="w-5 h-5" />
                            Registrar Questões
                        </Link>
                    </div>

                    {/* Card 2: Set Monthly Goal */}
                    <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700/50 flex flex-col items-center text-center space-y-6 hover:bg-slate-800/80 transition-all group">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <Target className="w-10 h-10 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Definir Meta Mensal</h2>
                            <p className="text-slate-400">Quantas questões você quer fazer neste mês?</p>
                        </div>

                        <div className="flex items-center gap-3 w-full max-w-xs">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    value={goalInput}
                                    onChange={(e) => setGoalInput(e.target.value)}
                                    className="w-full pl-4 pr-12 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">Qts</span>
                            </div>
                            <button
                                onClick={saveInitialGoal}
                                disabled={savingGoal || goalSaved}
                                className={`p-3 rounded-xl transition-all flex items-center justify-center ${goalSaved ? 'bg-green-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                    }`}
                            >
                                {savingGoal ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : goalSaved ? (
                                    <CalendarCheck className="w-5 h-5" />
                                ) : (
                                    <Trophy className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        {goalSaved && <p className="text-xs text-green-400 font-medium animate-fade-in">Meta salva com sucesso!</p>}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Meu Dashboard</h1>
                        <p className="text-slate-400">Acompanhe seu desempenho para a residência</p>
                    </div>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-3">
                        <select
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
                            className="px-3 py-2.5 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer hover:bg-slate-800"
                        >
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                            <option value="3m">Últimos 3 meses</option>
                            <option value="6m">Últimos 6 meses</option>
                            <option value="year">Este ano</option>
                        </select>

                        <select
                            value={disciplineFilter}
                            onChange={(e) => setDisciplineFilter(e.target.value)}
                            className="px-3 py-2.5 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer hover:bg-slate-800"
                        >
                            <option value="all">Todas disciplinas</option>
                            {allDisciplines.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>

                        <Link
                            href="/registrar"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                        >
                            <Plus className="w-5 h-5" />
                            Registrar
                        </Link>
                    </div>
                </div>

                {/* Mobile Actions Row */}
                <div className="flex md:hidden gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-center ${showFilters
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                            }`}
                    >
                        <Filter className="w-5 h-5" />
                    </button>
                    <Link
                        href="/registrar"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    >
                        <Plus className="w-5 h-5" />
                        Registrar Questões
                    </Link>
                </div>

                {/* Mobile Filters Panel */}
                {showFilters && (
                    <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Período</label>
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-blue-500 transition-all"
                            >
                                <option value="7d">Últimos 7 dias</option>
                                <option value="30d">Últimos 30 dias</option>
                                <option value="3m">Últimos 3 meses</option>
                                <option value="6m">Últimos 6 meses</option>
                                <option value="year">Este ano</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Disciplina</label>
                            <select
                                value={disciplineFilter}
                                onChange={(e) => setDisciplineFilter(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-blue-500 transition-all"
                            >
                                <option value="all">Todas disciplinas</option>
                                {allDisciplines.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Current Streak */}
                <div className={`rounded-2xl p-5 border flex items-center gap-4 ${streakData.current > 0
                    ? 'bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/30'
                    : 'bg-white/5 border-slate-700/50'
                    }`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${streakData.current > 0 ? 'bg-orange-500/30' : 'bg-slate-700/50'
                        }`}>
                        <Flame className={`w-6 h-6 ${streakData.current > 0 ? 'text-orange-400 animate-pulse' : 'text-slate-500'
                            }`} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400">Sequência</p>
                        <p className={`text-2xl font-bold ${streakData.current > 0 ? 'text-orange-400' : 'text-slate-500'
                            }`}>
                            {streakData.current} <span className="text-sm font-normal">dias</span>
                        </p>
                    </div>
                </div>



                {/* Record Streak */}
                <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 rounded-2xl p-5 border border-yellow-500/20 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400">Recorde</p>
                        <p className="text-2xl font-bold text-yellow-400">
                            {streakData.record} <span className="text-sm font-normal text-slate-400">dias</span>
                        </p>
                    </div>
                </div>

                {/* Total Questions */}
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 rounded-2xl p-5 border border-blue-500/20 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400">Total Questões</p>
                        <p className="text-2xl font-bold text-blue-400">
                            {stats.totalQuestions.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                {/* Overall Accuracy */}
                <div className={`rounded-2xl p-5 border flex items-center gap-4 ${stats.overallAccuracy >= 80 ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/20' :
                    stats.overallAccuracy >= 65 ? 'bg-gradient-to-br from-green-500/10 to-lime-500/5 border-green-500/20' :
                        stats.overallAccuracy >= 50 ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20' :
                            'bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/20'
                    }`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.overallAccuracy >= 80 ? 'bg-emerald-500/20' :
                        stats.overallAccuracy >= 65 ? 'bg-green-500/20' :
                            stats.overallAccuracy >= 50 ? 'bg-yellow-500/20' : 'bg-red-500/20'
                        }`}>
                        <TrendingUp className={`w-6 h-6 ${stats.overallAccuracy >= 80 ? 'text-emerald-400' :
                            stats.overallAccuracy >= 65 ? 'text-green-400' :
                                stats.overallAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400'
                            }`} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400">Taxa de Acerto</p>
                        <p className={`text-2xl font-bold ${stats.overallAccuracy >= 80 ? 'text-emerald-400' :
                            stats.overallAccuracy >= 65 ? 'text-green-400' :
                                stats.overallAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                            {stats.overallAccuracy.toFixed(1)}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Daily Review Widget */}
            <DailyReviewWidget />

            {/* Row 0.5: Reviews Card (Moved to top) */}
            {pendingReviews.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold text-white">Próximas Revisões</h3>
                        </div>
                        <Link href="/revisoes" className="text-sm text-blue-400 hover:text-blue-300">
                            Ver todas →
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {pendingReviews.map((review) => {
                            const reviewDate = new Date(review.scheduled_date + 'T12:00:00')
                            const isOverdue = isPast(reviewDate) && !isToday(reviewDate)
                            const isReviewToday = isToday(reviewDate)

                            return (
                                <div
                                    key={review.id}
                                    className={`p-3 rounded-xl border ${isOverdue
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : isReviewToday
                                            ? 'bg-yellow-500/10 border-yellow-500/30'
                                            : 'bg-slate-800/50 border-slate-700/50'
                                        }`}
                                >
                                    <p className={`text-xs font-medium mb-1 ${isOverdue ? 'text-red-400' : isReviewToday ? 'text-yellow-400' : 'text-blue-400'
                                        }`}>
                                        {isReviewToday ? 'Hoje' : isOverdue ? 'Atrasada' : format(reviewDate, "dd/MM")}
                                    </p>
                                    <p className="text-sm text-white truncate">
                                        {review.subdisciplines?.name || review.disciplines?.name || 'Revisão'}
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${review.review_type === '1d' ? 'bg-blue-500/20 text-blue-400' :
                                        review.review_type === '7d' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-green-500/20 text-green-400'
                                        }`}>
                                        {review.review_type === '1d' ? '1 dia' : review.review_type === '7d' ? '7 dias' : '30 dias'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Row 1: Performance Chart + Month Questions Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Performance Line Chart */}
                <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">Desempenho em questões</h3>
                            <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                                <span className="text-[10px] text-slate-400">i</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={monthlyAccuracy.map(d => ({
                                    ...d,
                                    level: getQualitativeLevel(d.accuracy),
                                    color: d.accuracy < 50 ? '#ef4444' : d.accuracy < 65 ? '#f59e0b' : d.accuracy < 80 ? '#22c55e' : '#10b981',
                                }))}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    {/* Gradiente dinâmico com faixas de cores */}
                                    <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="25%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={true} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#64748b"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, 4]}
                                    ticks={[1, 2, 3, 4]}
                                    tickFormatter={(value) => {
                                        const labels = ['', 'Ruim', 'Regular', 'Bom', 'Excelente']
                                        return labels[value] || ''
                                    }}
                                    width={70}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '12px',
                                    }}
                                    labelStyle={{ color: '#f1f5f9' }}
                                    formatter={(value, name) => {
                                        if (name === 'level' && typeof value === 'number') {
                                            const labels = ['', 'Ruim', 'Regular', 'Bom', 'Excelente']
                                            return [labels[value], 'Desempenho']
                                        }
                                        return [value, name]
                                    }}
                                />
                                {/* Faixas coloridas de referência */}
                                <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
                                <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                                <Area
                                    type="monotone"
                                    dataKey="level"
                                    stroke="#64748b"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorPerformance)"
                                    dot={(props) => {
                                        const { cx, cy, payload } = props
                                        const level = payload.level
                                        const dotColor = level <= 1 ? '#ef4444' : level <= 2 ? '#f59e0b' : level <= 3 ? '#22c55e' : '#10b981'
                                        return (
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={5}
                                                fill={dotColor}
                                                stroke="#1e293b"
                                                strokeWidth={2}
                                            />
                                        )
                                    }}
                                    activeDot={(props) => {
                                        const { cx, cy, payload } = props
                                        const level = payload.level
                                        const dotColor = level <= 1 ? '#ef4444' : level <= 2 ? '#f59e0b' : level <= 3 ? '#22c55e' : '#10b981'
                                        return (
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={7}
                                                fill={dotColor}
                                                stroke="#1e293b"
                                                strokeWidth={3}
                                            />
                                        )
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Questions per Month Card */}
                <div className={`
                    backdrop-blur-sm rounded-2xl p-4 sm:p-6 border flex flex-col relative overflow-hidden items-center transition-all duration-500
                    ${(stats.monthGoal && stats.monthQuestions >= stats.monthGoal)
                        ? 'bg-emerald-900/10 border-emerald-500/20 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]'
                        : (stats.monthGoal && stats.monthQuestions >= (stats.monthGoal / 2))
                            ? 'bg-amber-900/10 border-amber-500/20'
                            : 'bg-white/5 border-slate-700/50'}
                `}>
                    <h3 className="font-semibold text-white text-center mb-4">Questões feitas este mês</h3>

                    <Speedometer
                        value={stats.monthQuestions}
                        max={stats.monthGoal || 800}
                        size={220}
                    />

                    {stats.monthGoal && (
                        <div className="mt-4 w-full text-center">
                            <div className="flex justify-center text-xs mb-2 gap-2">
                                <span className={stats.monthQuestions < stats.monthGoal ? "text-amber-400" : "text-emerald-400"}>
                                    {stats.monthQuestions < stats.monthGoal
                                        ? `Meta: +${stats.dailyGoalNeeded}/dia`
                                        : "Meta batida! 🎉"}
                                </span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-500">{stats.daysRemaining} dias restantes</span>
                            </div>

                            {stats.dailyGoalNeeded > ((stats.monthGoal || 800) / 30) * 1.5 && (stats.monthQuestions < (stats.monthGoal || 800)) && (
                                <div className="flex items-center justify-center gap-2 mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
                                    <p className="text-xs text-amber-200">
                                        Aumente o ritmo!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Row 2: Discipline Bars */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">Desempenho de questões por grande área</h3>
                        <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                            <span className="text-[10px] text-slate-400">i</span>
                        </div>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-300">
                        Último ano
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    {disciplineStats.map((disc) => {
                        const Icon = disciplineIcons[disc.name] || Stethoscope
                        const color = disciplineColors[disc.name] || '#3b82f6'
                        return (
                            <div key={disc.name} className="flex items-center gap-4">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${color}20` }}
                                >
                                    <Icon className="w-4 h-4" style={{ color }} />
                                </div>
                                <div className="w-36 text-sm text-white truncate">{disc.name}</div>
                                <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden relative">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${disc.accuracy}%`,
                                            background: `linear-gradient(90deg, ${color}80, ${color})`
                                        }}
                                    />
                                </div>
                                <div className="w-12 text-right text-sm text-slate-300">{disc.accuracy.toFixed(0)}%</div>
                                <div className="w-24 text-right text-sm text-slate-500">{disc.questions} questões</div>
                            </div>
                        )
                    })}
                </div>
            </div>



            {/* Row 4: Time Chart + Subdiscipline Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Time Chart */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <h3 className="font-semibold text-white">Tempo de estudo</h3>
                            <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                                <span className="text-[10px] text-slate-400">i</span>
                            </div>
                        </div>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-300">
                            Últimos 15 dias
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="h-[200px]">
                        {timeData.some(d => d.hours > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${v}h`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#1e293b',
                                            border: '1px solid #334155',
                                            borderRadius: '12px',
                                        }}
                                        formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Tempo']}
                                    />
                                    <Bar
                                        dataKey="hours"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={30}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-slate-500 text-sm text-center">
                                    Registre o tempo de estudo para ver este gráfico.<br />
                                    <span className="text-slate-600">Campo "Tempo (minutos)" no registro.</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Subdiscipline Table */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Desempenho de questões por especialidades</h3>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-300">
                            Último ano
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    <table className="w-full">
                        <thead>
                            <tr className="text-xs text-slate-500 border-b border-slate-700/50">
                                <th className="text-left py-2 font-medium">Especialidade</th>
                                <th className="text-center py-2 font-medium">Questões feitas</th>
                                <th className="text-right py-2 font-medium">Desempenho</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subdisciplineStats.map((sub, i) => (
                                <tr key={i} className="border-b border-slate-700/30">
                                    <td className="py-3 text-sm text-white">{sub.name}</td>
                                    <td className="py-3 text-sm text-slate-400 text-center">{sub.questions}</td>
                                    <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className={`text-sm font-medium ${sub.accuracy >= 70 ? 'text-green-400' :
                                                sub.accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {sub.accuracy.toFixed(0)}%
                                            </span>
                                            {sub.trend === 'up' && (
                                                <TrendingUp className="w-4 h-4 text-green-400" />
                                            )}
                                            {sub.trend === 'down' && (
                                                <TrendingDown className="w-4 h-4 text-red-400" />
                                            )}
                                            {sub.trend === 'neutral' && (
                                                <Minus className="w-4 h-4 text-slate-500" />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function DailyReviewWidget() {
    const [reviewItem, setReviewItem] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showAnswer, setShowAnswer] = useState(false)
    const [reviewed, setReviewed] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        loadDailyReview()
    }, [])

    async function loadDailyReview() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get a random item that hasn't been reviewed much, or simply random
            // Ideally we'd implement SR algorithm, but for now random selection is fine
            // We fetch up to 10 items and pick 1 randomly client-side to be efficient
            const { data } = await supabase
                .from('error_notebook')
                .select('*, disciplines(name)')
                .eq('user_id', user.id)
                .limit(10)

            if (data && data.length > 0) {
                const randomItem = data[Math.floor(Math.random() * data.length)]
                setReviewItem(randomItem)
            }
        } catch (error) {
            console.error('Error loading daily review:', error)
        } finally {
            setLoading(false)
        }
    }

    async function markAsReviewed() {
        if (!reviewItem) return
        try {
            await supabase.from('error_notebook')
                .update({ review_count: (reviewItem.review_count || 0) + 1 })
                .eq('id', reviewItem.id)
            setReviewed(true)
        } catch (error) {
            console.error('Error marking as reviewed:', error)
        }
    }

    if (loading) return <Skeleton className="h-64 rounded-3xl w-full" />

    if (!reviewItem) return null // Don't show widget if no errors logged

    return (
        <div className="mb-8 p-6 bg-gradient-to-br from-indigo-900/40 to-slate-900/60 rounded-3xl border border-indigo-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <BookOpen className="w-32 h-32 text-indigo-400" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Revisão do Dia</h3>
                        <p className="text-slate-400 text-sm">Responda mentalmente antes de revelar.</p>
                    </div>
                    {reviewItem.disciplines && (
                        <span className="ml-auto px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                            {reviewItem.disciplines.name}
                        </span>
                    )}
                </div>

                <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/50 mb-4 backdrop-blur-sm">
                    <p className="text-lg text-slate-200 font-medium leading-relaxed">
                        {reviewItem.question_text}
                    </p>
                </div>

                {showAnswer ? (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-5">
                            <h4 className="text-emerald-400 text-sm font-bold mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4" /> Resposta Correta
                            </h4>
                            <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                                {reviewItem.answer_text}
                            </p>
                            {reviewItem.notes && (
                                <div className="mt-4 pt-4 border-t border-emerald-500/20">
                                    <p className="text-indigo-300 text-sm flex gap-2">
                                        <span className="font-bold">Nota:</span> {reviewItem.notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {!reviewed ? (
                            <button
                                onClick={markAsReviewed}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                <Trophy className="w-5 h-5" />
                                Marcar como Revisado
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 font-medium bg-emerald-900/20 rounded-xl border border-emerald-500/20">
                                <Trophy className="w-5 h-5" />
                                Revisão Concluída!
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full py-3 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 rounded-xl font-medium transition-all border border-slate-700 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        <BookOpen className="w-5 h-5" />
                        Revelar Resposta
                    </button>
                )}
            </div>
        </div>
    )
}

