'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { MonthlyEvolutionChart } from '@/components/charts'
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { getMonthName } from '@/lib/utils'

interface MonthlyStats {
    month: number
    year: number
    totalQuestions: number
    totalCorrect: number
    accuracy: number
}

interface SpecialtyData {
    name: string
    questions: number
    accuracy: number
}

export default function EvolucaoTab() {
    const [stats, setStats] = useState<MonthlyStats[]>([])
    const [specialtyData, setSpecialtyData] = useState<SpecialtyData[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()
    const currentYear = new Date().getFullYear()

    useEffect(() => {
        loadStats()
    }, [])

    async function loadStats() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: logs } = await supabase
                .from('question_logs')
                .select('date, questions_done, correct_answers, subdisciplines(name)')
                .eq('user_id', user.id)
                .gte('date', `${currentYear}-01-01`)
                .lte('date', `${currentYear}-12-31`)

            if (!logs) return

            // Aggregate by month for Evolution Chart
            const statsMap: { [key: number]: MonthlyStats } = {}

            // Aggregate by subdiscipline (Specialties)
            const specialtyMap: { [key: string]: { questions: number, correct: number } } = {}

            logs.forEach((log) => {
                // Monthly Stats
                const month = new Date(log.date).getMonth() + 1
                if (!statsMap[month]) {
                    statsMap[month] = {
                        month,
                        year: currentYear,
                        totalQuestions: 0,
                        totalCorrect: 0,
                        accuracy: 0,
                    }
                }
                statsMap[month].totalQuestions += log.questions_done
                statsMap[month].totalCorrect += log.correct_answers

                // Specialty Stats
                const specialtyName = log.subdisciplines?.name || 'Geral'
                if (!specialtyMap[specialtyName]) {
                    specialtyMap[specialtyName] = { questions: 0, correct: 0 }
                }
                specialtyMap[specialtyName].questions += log.questions_done
                specialtyMap[specialtyName].correct += log.correct_answers
            })

            // Calculate accuracy and sort by month
            const result = Object.values(statsMap)
                .map((stat) => ({
                    ...stat,
                    accuracy:
                        stat.totalQuestions > 0
                            ? (stat.totalCorrect / stat.totalQuestions) * 100
                            : 0,
                }))
                .sort((a, b) => a.month - b.month)

            setStats(result)

            // Prepare Specialty Data
            const specialtyResult = Object.entries(specialtyMap)
                .map(([name, data]) => ({
                    name,
                    questions: data.questions,
                    accuracy: data.questions > 0 ? (data.correct / data.questions) * 100 : 0,
                }))
                .filter(item => item.questions >= 3)
                .sort((a, b) => b.accuracy - a.accuracy)

            setSpecialtyData(specialtyResult)
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getTrendIcon = (current: number, previous: number | null) => {
        if (previous === null) return <Minus className="w-4 h-4 text-slate-400" />
        if (current > previous) return <ArrowUp className="w-4 h-4 text-green-400" />
        if (current < previous) return <ArrowDown className="w-4 h-4 text-red-400" />
        return <Minus className="w-4 h-4 text-slate-400" />
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        )
    }

    if (stats.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={TrendingUp}
                    title="Sem dados de evolução"
                    description="Registre questões ao longo dos meses para ver sua evolução."
                />
            </div>
        )
    }

    const chartData = stats.map((s) => ({
        name: getMonthName(s.month).substring(0, 3),
        questions: s.totalQuestions,
        accuracy: s.accuracy,
    }))

    // Calculate totals
    const totalQuestions = stats.reduce((sum, s) => sum + s.totalQuestions, 0)
    const overallAccuracy = totalQuestions > 0 ? (stats.reduce((sum, s) => sum + s.totalCorrect, 0) / totalQuestions) * 100 : 0

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-white">Evolução Mensal</h3>
                <p className="text-sm text-slate-400">Progresso ao longo de {currentYear}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <p className="text-sm text-slate-400 mb-1">Total no Ano</p>
                    <p className="text-2xl font-bold text-white">
                        {totalQuestions.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-sm text-slate-500">questões</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <p className="text-sm text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-2xl font-bold text-white">
                        {Math.round(totalQuestions / stats.length).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-sm text-slate-500">questões/mês</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <p className="text-sm text-slate-400 mb-1">Aproveitamento Geral</p>
                    <AccuracyBadge accuracy={overallAccuracy} size="lg" />
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 gap-6">
                {/* Evolution Chart */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                    <h3 className="font-semibold text-white mb-4">Evolução Mensal</h3>
                    <MonthlyEvolutionChart data={chartData} />
                </div>

                {/* Specialties List (Best & Worst) */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                    <h3 className="font-semibold text-white mb-6">Desempenho por Especialidade</h3>

                    {specialtyData.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            {/* Left Column: Top Performers (First Half) */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-green-400 mb-3 uppercase tracking-wider">Melhores Desempenhos</h4>
                                {specialtyData.slice(0, Math.ceil(specialtyData.length / 2)).map((item, index) => (
                                    <div key={item.name} className="group">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-300 truncate group-hover:text-white transition-colors" title={item.name}>
                                                {index + 1}. {item.name}
                                            </span>
                                            <span className="text-slate-400 text-xs text-right min-w-[3rem]">
                                                {item.questions} q
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
                                                    style={{ width: `${item.accuracy}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-green-400 w-9 text-right">
                                                {item.accuracy.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Right Column: Lower Performers (Second Half) */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-amber-400 mb-3 uppercase tracking-wider">Pontos de Atenção</h4>
                                {specialtyData.slice(Math.ceil(specialtyData.length / 2)).map((item, index) => (
                                    <div key={item.name} className="group">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-300 truncate group-hover:text-white transition-colors" title={item.name}>
                                                {Math.ceil(specialtyData.length / 2) + index + 1}. {item.name}
                                            </span>
                                            <span className="text-slate-400 text-xs text-right min-w-[3rem]">
                                                {item.questions} q
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${item.accuracy < 50 ? 'bg-gradient-to-r from-red-600 to-red-500' :
                                                        item.accuracy < 70 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                                            'bg-slate-500'
                                                        }`}
                                                    style={{ width: `${item.accuracy}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-bold w-9 text-right ${item.accuracy < 50 ? 'text-red-400' :
                                                item.accuracy < 70 ? 'text-amber-400' :
                                                    'text-slate-400'
                                                }`}>
                                                {item.accuracy.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-slate-500">
                            Sem dados suficientes para gerar o ranking.
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Mês</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Questões</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Acertos</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Erros</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Taxa</th>
                                <th className="text-center py-4 px-6 text-sm font-medium text-slate-400">Tendência</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat, index) => {
                                const previousAccuracy = index > 0 ? stats[index - 1].accuracy : null
                                return (
                                    <tr
                                        key={stat.month}
                                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                                    >
                                        <td className="py-4 px-6">
                                            <span className="font-medium text-white">
                                                {getMonthName(stat.month)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right text-slate-300">
                                            {stat.totalQuestions.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-4 px-6 text-right text-green-400">
                                            {stat.totalCorrect.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-4 px-6 text-right text-red-400">
                                            {(stat.totalQuestions - stat.totalCorrect).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <AccuracyBadge accuracy={stat.accuracy} />
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center">
                                                {getTrendIcon(stat.accuracy, previousAccuracy)}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
