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

export default function DisciplinasPage() {
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

            const [
                { data: logs },
                { data: disciplines }
            ] = await Promise.all([
                supabase
                    .from('question_logs')
                    .select('questions_done, correct_answers, discipline_id')
                    .eq('user_id', user.id),
                // NOTE: question_logs already contains all exam questions (inserted by ExamWizard).
                // No need to also fetch exam_scores — that would double-count.
                supabase
                    .from('disciplines')
                    .select('id, name')
            ])

            // Helper to get discipline name
            const getDisciplineName = (id: number) =>
                disciplines?.find(d => d.id === id)?.name || 'Desconhecida'

            // Aggregate stats
            const statsMap: { [key: number]: DisciplineStats } = {}

            // Process Question Logs
            logs?.forEach((log) => {
                if (!log.discipline_id) return

                if (!statsMap[log.discipline_id]) {
                    statsMap[log.discipline_id] = {
                        id: log.discipline_id,
                        name: getDisciplineName(log.discipline_id),
                        totalQuestions: 0,
                        totalCorrect: 0,
                        accuracy: 0,
                    }
                }

                statsMap[log.discipline_id].totalQuestions += log.questions_done
                statsMap[log.discipline_id].totalCorrect += log.correct_answers
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
                .filter(stat => stat.totalQuestions > 0)
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
        if (index === 1) return <Medal className="w-5 h-5 text-zinc-300" />
        if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />
        return <span className="w-5 h-5 flex items-center justify-center text-zinc-500 text-sm font-medium">{index + 1}</span>
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
            <div className="h-full flex items-center justify-center">
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
            <div>
                <h1 className="text-2xl font-bold text-white">Desempenho por Disciplina</h1>
                <p className="text-zinc-400">Ranking das disciplinas por taxa de acerto</p>
            </div>

            {/* Chart */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700/50">
                <h3 className="font-semibold text-white mb-4">Comparativo de Acertos</h3>
                <DisciplineComparisonChart data={chartData} height={Math.max(300, stats.length * 50)} />
            </div>

            {/* Table */}
            <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-700/50">
                                <th className="text-left py-4 px-6 text-sm font-medium text-zinc-400">Rank</th>
                                <th className="text-left py-4 px-6 text-sm font-medium text-zinc-400">Disciplina</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Questões</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Acertos</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Taxa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat, index) => (
                                <tr
                                    key={stat.id}
                                    className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition-colors"
                                >
                                    <td className="py-4 px-6">
                                        <div className="flex items-center justify-center w-8 h-8">
                                            {getRankIcon(index)}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="font-medium text-white">{stat.name}</span>
                                    </td>
                                    <td className="py-4 px-6 text-right text-zinc-300">
                                        {stat.totalQuestions.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="py-4 px-6 text-right text-zinc-300">
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
