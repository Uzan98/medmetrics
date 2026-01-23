'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { Tags, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import type { Discipline, Subdiscipline } from '@/types/database'

interface TopicStats {
    id: number
    name: string
    subdisciplineId: number
    subdisciplineName: string
    disciplineId: number
    disciplineName: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
}

export default function AssuntosTab() {
    const [stats, setStats] = useState<TopicStats[]>([])
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [subdisciplines, setSubdisciplines] = useState<Subdiscipline[]>([])
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('')
    const [selectedSubdiscipline, setSelectedSubdiscipline] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'worst' | 'best'>('worst')
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [disciplinesRes, subdisciplinesRes, logsRes] = await Promise.all([
                supabase.from('disciplines').select('*').order('name'),
                supabase.from('subdisciplines').select('*').order('name'),
                supabase
                    .from('question_logs')
                    .select(`
                        topic_id,
                        subdiscipline_id,
                        discipline_id,
                        questions_done,
                        correct_answers,
                        topics(id, name, subdiscipline_id),
                        subdisciplines(id, name, discipline_id),
                        disciplines(id, name)
                    `)
                    .eq('user_id', user.id)
                    .not('topic_id', 'is', null),
            ])

            if (disciplinesRes.data) setDisciplines(disciplinesRes.data)
            if (subdisciplinesRes.data) setSubdisciplines(subdisciplinesRes.data)

            if (!logsRes.data) return

            // Aggregate by topic
            const statsMap: { [key: number]: TopicStats } = {}

            logsRes.data.forEach((log) => {
                if (!log.topic_id || !log.topics) return

                const topic = log.topics as { id: number; name: string; subdiscipline_id: number }
                const subdiscipline = log.subdisciplines as { id: number; name: string; discipline_id: number } | null
                const discipline = log.disciplines as { id: number; name: string } | null

                if (!statsMap[topic.id]) {
                    statsMap[topic.id] = {
                        id: topic.id,
                        name: topic.name,
                        subdisciplineId: subdiscipline?.id || 0,
                        subdisciplineName: subdiscipline?.name || 'N/A',
                        disciplineId: discipline?.id || 0,
                        disciplineName: discipline?.name || 'N/A',
                        totalQuestions: 0,
                        totalCorrect: 0,
                        accuracy: 0
                    }
                }

                statsMap[topic.id].totalQuestions += log.questions_done
                statsMap[topic.id].totalCorrect += log.correct_answers
            })

            // Calculate accuracy
            const result = Object.values(statsMap)
                .map((stat) => ({
                    ...stat,
                    accuracy: stat.totalQuestions > 0 ? (stat.totalCorrect / stat.totalQuestions) * 100 : 0,
                }))

            setStats(result)
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    // Filter logic
    const filteredSubdisciplines = selectedDiscipline
        ? subdisciplines.filter(s => s.discipline_id === Number(selectedDiscipline))
        : subdisciplines

    let filteredStats = stats
    if (selectedDiscipline) {
        filteredStats = filteredStats.filter(s => s.disciplineId === Number(selectedDiscipline))
    }
    if (selectedSubdiscipline) {
        filteredStats = filteredStats.filter(s => s.subdisciplineId === Number(selectedSubdiscipline))
    }

    // Sort
    filteredStats = [...filteredStats].sort((a, b) =>
        sortOrder === 'worst' ? a.accuracy - b.accuracy : b.accuracy - a.accuracy
    )

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-12 w-full max-w-md" />
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (stats.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={Tags}
                    title="Sem dados de assuntos"
                    description="Registre questões com assuntos (tópicos) para ver seu desempenho por tema."
                />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Desempenho por Assunto</h3>
                    <p className="text-sm text-slate-400">
                        Ordenado do {sortOrder === 'worst' ? 'pior para o melhor' : 'melhor para o pior'}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={selectedDiscipline}
                        onChange={(e) => {
                            setSelectedDiscipline(e.target.value)
                            setSelectedSubdiscipline('')
                        }}
                        className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todas disciplinas</option>
                        {disciplines.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedSubdiscipline}
                        onChange={(e) => setSelectedSubdiscipline(e.target.value)}
                        className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todas subdisciplinas</option>
                        {filteredSubdisciplines.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setSortOrder(sortOrder === 'worst' ? 'best' : 'worst')}
                        className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
                    >
                        {sortOrder === 'worst' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {sortOrder === 'worst' ? 'Pior → Melhor' : 'Melhor → Pior'}
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Total de Assuntos</p>
                    <p className="text-2xl font-bold text-white">{filteredStats.length}</p>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Questões</p>
                    <p className="text-2xl font-bold text-white">
                        {filteredStats.reduce((acc, s) => acc + s.totalQuestions, 0).toLocaleString('pt-BR')}
                    </p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                    <p className="text-xs text-red-300 mb-1">Assuntos Críticos (&lt;60%)</p>
                    <p className="text-2xl font-bold text-red-400">
                        {filteredStats.filter(s => s.accuracy < 60).length}
                    </p>
                </div>
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                    <p className="text-xs text-green-300 mb-1">Assuntos Dominados (&gt;80%)</p>
                    <p className="text-2xl font-bold text-green-400">
                        {filteredStats.filter(s => s.accuracy >= 80).length}
                    </p>
                </div>
            </div>

            {/* Stats list */}
            <div className="space-y-2">
                {filteredStats.map((stat) => (
                    <div
                        key={stat.id}
                        className={`p-4 rounded-xl border transition-all ${stat.accuracy < 60
                            ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                            : stat.accuracy < 75
                                ? 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40'
                                : 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white truncate">{stat.name}</h3>
                                <p className="text-xs text-slate-400">
                                    {stat.subdisciplineName} • {stat.disciplineName}
                                </p>
                            </div>
                            <div className="flex items-center gap-4 ml-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs text-slate-400">Questões</p>
                                    <p className="font-medium text-white">
                                        {stat.totalQuestions.toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <AccuracyBadge accuracy={stat.accuracy} size="lg" />
                                </div>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-slate-700/30 rounded-full overflow-hidden">
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
                    </div>
                ))}

                {filteredStats.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        Nenhum assunto encontrado para estes filtros.
                    </div>
                )}
            </div>
        </div>
    )
}
