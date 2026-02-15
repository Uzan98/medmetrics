'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { Layers, Filter } from 'lucide-react'
import type { Discipline } from '@/types/database'

interface SubdisciplineStats {
    id: number
    name: string
    disciplineName: string
    disciplineId: number
    totalQuestions: number
    totalCorrect: number
    accuracy: number
    topics: TopicStats[]
}

interface TopicStats {
    id: number
    name: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
}

export default function SubdisciplinasTab() {
    const [stats, setStats] = useState<SubdisciplineStats[]>([])
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('')
    const [expandedSubdiscipline, setExpandedSubdiscipline] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [disciplinesRes, logsRes] = await Promise.all([
                supabase.from('disciplines').select('*').order('name'),
                supabase
                    .from('question_logs')
                    .select(`
            subdiscipline_id,
            discipline_id,
            topic_id,
            questions_done,
            correct_answers,
            subdisciplines(id, name, discipline_id),
            disciplines(id, name),
            topics(id, name)
          `)
                    .eq('user_id', user.id),
            ])

            if (disciplinesRes.data) setDisciplines(disciplinesRes.data)

            if (!logsRes.data) return

            // Aggregate by subdiscipline
            const statsMap: { [key: number]: SubdisciplineStats } = {}

            logsRes.data.forEach((log) => {
                if (!log.subdiscipline_id || !log.subdisciplines || !log.disciplines) return

                const subdiscipline = log.subdisciplines as { id: number; name: string; discipline_id: number }
                const discipline = log.disciplines as { id: number; name: string }
                const topic = log.topics as { id: number; name: string } | null

                if (!statsMap[subdiscipline.id]) {
                    statsMap[subdiscipline.id] = {
                        id: subdiscipline.id,
                        name: subdiscipline.name,
                        disciplineName: discipline.name,
                        disciplineId: discipline.id,
                        totalQuestions: 0,
                        totalCorrect: 0,
                        accuracy: 0,
                        topics: []
                    }
                }

                statsMap[subdiscipline.id].totalQuestions += log.questions_done
                statsMap[subdiscipline.id].totalCorrect += log.correct_answers

                // Aggregate Topic Stats within Subdiscipline
                if (topic) {
                    const existingTopic = statsMap[subdiscipline.id].topics.find(t => t.id === topic.id)
                    if (existingTopic) {
                        existingTopic.totalQuestions += log.questions_done
                        existingTopic.totalCorrect += log.correct_answers
                    } else {
                        statsMap[subdiscipline.id].topics.push({
                            id: topic.id,
                            name: topic.name,
                            totalQuestions: log.questions_done,
                            totalCorrect: log.correct_answers,
                            accuracy: 0
                        })
                    }
                }
            })

            // Calculate accuracy and sort
            const result = Object.values(statsMap)
                .map((stat) => {
                    // Calculate topics accuracy
                    stat.topics = stat.topics.map(t => ({
                        ...t,
                        accuracy: t.totalQuestions > 0 ? (t.totalCorrect / t.totalQuestions) * 100 : 0
                    })).sort((a, b) => a.accuracy - b.accuracy) // Sort topics by accuracy (worst to best)

                    return {
                        ...stat,
                        accuracy: stat.totalQuestions > 0 ? (stat.totalCorrect / stat.totalQuestions) * 100 : 0,
                    }
                })
                .sort((a, b) => a.accuracy - b.accuracy)

            setStats(result)
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredStats = selectedDiscipline
        ? stats.filter((s) => s.disciplineId === Number(selectedDiscipline))
        : stats

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-12 w-64" />
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (stats.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={Layers}
                    title="Sem dados de subdisciplinas"
                    description="Registre questões com subdisciplinas para ver seu desempenho detalhado."
                />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Desempenho por Subdisciplina</h3>
                    <p className="text-sm text-zinc-400">Ordenado do pior para o melhor desempenho</p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-zinc-400" />
                    <select
                        value={selectedDiscipline}
                        onChange={(e) => setSelectedDiscipline(e.target.value)}
                        className="px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todas as disciplinas</option>
                        {disciplines.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats cards */}
            <div className="space-y-3">
                {filteredStats.map((stat) => (
                    <div
                        key={stat.id}
                        className={`p-5 rounded-xl border transition-all ${stat.accuracy < 60
                            ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                            : stat.accuracy < 75
                                ? 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40'
                                : 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                            }`}
                    >
                        <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedSubdiscipline(expandedSubdiscipline === stat.id ? null : stat.id)}
                        >
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white truncate">{stat.name}</h3>
                                <p className="text-sm text-zinc-400">{stat.disciplineName}</p>
                            </div>
                            <div className="flex items-center gap-6 ml-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs text-zinc-400">Questões</p>
                                    <p className="font-medium text-white">
                                        {stat.totalQuestions.toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-zinc-400 mb-1 hidden sm:block">Taxa</p>
                                    <AccuracyBadge accuracy={stat.accuracy} size="lg" />
                                </div>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-2 bg-zinc-700/30 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${stat.accuracy < 60
                                    ? 'bg-red-500'
                                    : stat.accuracy < 75
                                        ? 'bg-yellow-500'
                                        : 'bg-green-500'
                                    }`}
                                style={{ width: `${stat.accuracy}%` }}
                            />
                        </div>

                        {/* Topics Expansion */}
                        {expandedSubdiscipline === stat.id && stat.topics.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-zinc-700/30 animate-fade-in pl-4 border-l-2 border-l-zinc-700/30 ml-2">
                                <h4 className="text-sm font-medium text-zinc-400 mb-3">Desempenho por Assunto</h4>
                                <div className="space-y-4">
                                    {stat.topics.map(topic => (
                                        <div key={topic.id} className="group">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-zinc-300">{topic.name}</span>
                                                <span className="text-zinc-500 text-xs">
                                                    {topic.totalQuestions} q · <span className={topic.accuracy >= 70 ? 'text-green-400' : topic.accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                                                        {topic.accuracy.toFixed(0)}%
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-zinc-700/30 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${topic.accuracy < 60 ? 'bg-red-500' :
                                                        topic.accuracy < 75 ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${topic.accuracy}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {expandedSubdiscipline === stat.id && stat.topics.length === 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-700/30 text-center text-sm text-zinc-500">
                                Nenhum assunto específico registrado ainda.
                            </div>
                        )}
                    </div>
                ))}

                {filteredStats.length === 0 && (
                    <div className="text-center py-12 text-zinc-400">
                        Nenhuma subdisciplina encontrada para este filtro.
                    </div>
                )}
            </div>
        </div>
    )
}
