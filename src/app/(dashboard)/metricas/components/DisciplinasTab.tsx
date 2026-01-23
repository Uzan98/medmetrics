'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { DisciplineComparisonChart } from '@/components/charts'
import { BookOpen, Trophy, Medal } from 'lucide-react'

interface DisciplineStats {
    id: number
    name: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
}

export default function DisciplinasTab() {
    const [stats, setStats] = useState<DisciplineStats[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        loadStats()
    }, [])

    async function loadStats() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: logs } = await supabase
                .from('question_logs')
                .select(`
          questions_done,
          correct_answers,
          discipline_id,
          disciplines(id, name)
        `)
                .eq('user_id', user.id)

            if (!logs) return

            // Aggregate by discipline
            const statsMap: { [key: number]: DisciplineStats } = {}

            logs.forEach((log) => {
                if (!log.discipline_id || !log.disciplines) return

                const discipline = log.disciplines as { id: number; name: string }

                if (!statsMap[discipline.id]) {
                    statsMap[discipline.id] = {
                        id: discipline.id,
                        name: discipline.name,
                        totalQuestions: 0,
                        totalCorrect: 0,
                        accuracy: 0,
                    }
                }

                statsMap[discipline.id].totalQuestions += log.questions_done
                statsMap[discipline.id].totalCorrect += log.correct_answers
            })

            // Calculate accuracy and sort
            const result = Object.values(statsMap)
                .map((stat) => ({
                    ...stat,
                    accuracy:
                        stat.totalQuestions > 0
                            ? (stat.totalCorrect / stat.totalQuestions) * 100
                            : 0,
                }))
                .sort((a, b) => b.accuracy - a.accuracy)

            setStats(result)
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />
        if (index === 1) return <Medal className="w-5 h-5 text-slate-300" />
        if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />
        return <span className="w-5 h-5 flex items-center justify-center text-slate-500 text-sm font-medium">{index + 1}</span>
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        )
    }

    if (stats.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={BookOpen}
                    title="Sem dados de disciplinas"
                    description="Registre algumas questões para ver seu desempenho por disciplina."
                />
            </div>
        )
    }

    const chartData = stats.map((s) => ({
        name: s.name,
        accuracy: s.accuracy,
        questions: s.totalQuestions,
    }))

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-white">Ranking de Disciplinas</h3>
                <p className="text-sm text-slate-400">Comparativo de desempenho entre matérias</p>
            </div>

            {/* Chart */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-4">Comparativo de Acertos</h3>
                <DisciplineComparisonChart data={chartData} height={Math.max(300, stats.length * 50)} />
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Rank</th>
                                <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Disciplina</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Questões</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Acertos</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Taxa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat, index) => (
                                <tr
                                    key={stat.id}
                                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                                >
                                    <td className="py-4 px-6">
                                        <div className="flex items-center justify-center w-8 h-8">
                                            {getRankIcon(index)}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="font-medium text-white">{stat.name}</span>
                                    </td>
                                    <td className="py-4 px-6 text-right text-slate-300">
                                        {stat.totalQuestions.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="py-4 px-6 text-right text-slate-300">
                                        {stat.totalCorrect.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <AccuracyBadge accuracy={stat.accuracy} />
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
