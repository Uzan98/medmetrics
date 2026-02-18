'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Cell, LabelList
} from 'recharts'
import { Loader2, AlertCircle, FileText, Trash2, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface ExamMetric {
    id: string
    title: string | null
    date: string
    rawDate: string
    year: number
    boardName: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
}

interface DisciplineMetric {
    name: string
    total: number
    correct: number
    accuracy: number
}

const BOARD_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

export default function ProvasTab() {
    const [loading, setLoading] = useState(true)
    const [exams, setExams] = useState<ExamMetric[]>([])
    const [disciplineMetrics, setDisciplineMetrics] = useState<DisciplineMetric[]>([])
    const [deleting, setDeleting] = useState<string | null>(null)
    const [selectedBoard, setSelectedBoard] = useState<string>('all')
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    // Derive unique boards from exams
    const boards = useMemo(() => {
        const unique = [...new Set(exams.map(e => e.boardName))].sort()
        return unique
    }, [exams])

    // Filter exams by selected board
    const filteredExams = useMemo(() => {
        if (selectedBoard === 'all') return exams
        return exams.filter(e => e.boardName === selectedBoard)
    }, [exams, selectedBoard])

    // For evolution chart: group by board for multi-line when "all" is selected
    const evolutionData = useMemo(() => {
        if (selectedBoard !== 'all') {
            // Single board: simple line
            return filteredExams.map(e => ({
                label: `${e.boardName} ${e.year}`,
                date: e.date,
                accuracy: e.accuracy,
                totalQuestions: e.totalQuestions,
                totalCorrect: e.totalCorrect,
            }))
        }
        // All boards: return flat list with boardName for tooltip
        return exams.map(e => ({
            label: `${e.boardName} ${e.year}`,
            date: e.date,
            accuracy: e.accuracy,
            boardName: e.boardName,
            totalQuestions: e.totalQuestions,
            totalCorrect: e.totalCorrect,
        }))
    }, [exams, filteredExams, selectedBoard])

    // Discipline metrics filtered by board
    const filteredDisciplineMetrics = useMemo(() => {
        // We recalculate from raw data when board filter changes
        // For now, if selectedBoard is 'all', return the full metrics
        return disciplineMetrics
    }, [disciplineMetrics])

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta prova? Todos os dados associados serão perdidos.')) return

        setDeleting(id)
        try {
            await supabase.from('exam_scores').delete().eq('exam_id', id)
            const { error } = await supabase.from('exams').delete().eq('id', id)
            if (error) throw error

            await loadData()
        } catch (err) {
            console.error('Error deleting exam:', err)
            toast.error('Erro ao excluir prova')
        } finally {
            setDeleting(null)
        }
    }

    async function loadData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: examsData, error } = await supabase
                .from('exams')
                .select(`
                    id,
                    title,
                    date,
                    year,
                    exam_boards(name),
                    exam_scores(
                        questions_total,
                        questions_correct,
                        disciplines(name)
                    )
                `)
                .eq('user_id', user.id)
                .order('date', { ascending: true })

            if (error) throw error

            if (examsData) {
                const processedExams = examsData.map(exam => {
                    let totalQ = 0
                    let totalC = 0

                    if (Array.isArray(exam.exam_scores)) {
                        exam.exam_scores.forEach(score => {
                            totalQ += score.questions_total
                            totalC += score.questions_correct
                        })
                    }

                    return {
                        id: exam.id,
                        title: exam.title || 'Sem título',
                        date: format(new Date(exam.date), 'dd/MM/yyyy'),
                        rawDate: exam.date,
                        year: exam.year,
                        boardName: (exam.exam_boards as any)?.name || 'Desconhecida',
                        totalQuestions: totalQ,
                        totalCorrect: totalC,
                        accuracy: totalQ > 0 ? Number(((totalC / totalQ) * 100).toFixed(1)) : 0
                    }
                })

                setExams(processedExams)

                // Process Discipline Metrics
                const discMap: { [key: string]: { total: number, correct: number } } = {}

                examsData.forEach(exam => {
                    if (Array.isArray(exam.exam_scores)) {
                        exam.exam_scores.forEach(score => {
                            const discName = (score.disciplines as any)?.name || 'Outros'
                            if (!discMap[discName]) {
                                discMap[discName] = { total: 0, correct: 0 }
                            }
                            discMap[discName].total += score.questions_total
                            discMap[discName].correct += score.questions_correct
                        })
                    }
                })

                const processedDiscs = Object.entries(discMap).map(([name, stats]) => ({
                    name,
                    total: stats.total,
                    correct: stats.correct,
                    accuracy: stats.total > 0 ? Number(((stats.correct / stats.total) * 100).toFixed(1)) : 0
                })).sort((a, b) => b.accuracy - a.accuracy)

                setDisciplineMetrics(processedDiscs)
            }

        } catch (err) {
            console.error('Error loading exam metrics:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (exams.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
                <FileText className="w-12 h-12 text-zinc-500 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Nenhuma prova registrada</h3>
                <p className="text-zinc-400 text-center max-w-md">
                    Registre suas provas na íntegra para visualizar gráficos de evolução e desempenho por área.
                </p>
            </div>
        )
    }

    // Board aggregate data for bar chart
    const boardAggData = Object.values(filteredExams.reduce((acc, curr) => {
        if (!acc[curr.boardName]) acc[curr.boardName] = { name: curr.boardName, total: 0, correct: 0, accuracy: 0, count: 0 }
        acc[curr.boardName].total += curr.totalQuestions
        acc[curr.boardName].correct += curr.totalCorrect
        acc[curr.boardName].count += 1
        return acc
    }, {} as Record<string, { name: string, total: number, correct: number, accuracy: number, count: number }>)).map(b => ({
        ...b,
        accuracy: b.total > 0 ? Number(((b.correct / b.total) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.accuracy - a.accuracy)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Board Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Provas na Íntegra</h3>
                    <p className="text-sm text-zinc-400">
                        {selectedBoard === 'all'
                            ? `${exams.length} provas registradas`
                            : `${filteredExams.length} provas de ${selectedBoard}`
                        }
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-zinc-400" />
                    <select
                        value={selectedBoard}
                        onChange={e => setSelectedBoard(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Todas as bancas</option>
                        {boards.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Evolution Chart — filtered by board */}
            <div className="bg-zinc-800/50 rounded-2xl p-4 sm:p-6 border border-zinc-700/50">
                <h3 className="text-lg font-semibold text-white mb-2">Evolução de Acertos (%)</h3>
                {selectedBoard !== 'all' && (
                    <p className="text-xs text-zinc-500 mb-4">
                        Compare seu desempenho em provas de <span className="text-indigo-400 font-medium">{selectedBoard}</span> ao longo do tempo
                    </p>
                )}
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolutionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#a1a1aa"
                                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                angle={-25}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                stroke="#a1a1aa"
                                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                domain={[0, 100]}
                                tickLine={false}
                                axisLine={false}
                                unit="%"
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                itemStyle={{ color: '#fff', fontSize: '0.875rem', fontWeight: 600 }}
                                formatter={(value: any, _name?: string, props?: any) => {
                                    const payload = props?.payload
                                    if (payload) {
                                        return [`${Number(value)}% (${payload.totalCorrect}/${payload.totalQuestions})`, 'Acertos']
                                    }
                                    return [`${Number(value)}%`, 'Acertos']
                                }}
                                labelStyle={{ color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="accuracy"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                                activeDot={{ r: 7, fill: '#fff' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Board comparison: show trend when a specific board is selected */}
                {selectedBoard !== 'all' && filteredExams.length >= 2 && (
                    <div className="mt-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-700/30">
                        {(() => {
                            const first = filteredExams[0]
                            const last = filteredExams[filteredExams.length - 1]
                            const diff = last.accuracy - first.accuracy
                            const isPositive = diff > 0
                            return (
                                <div className="flex items-center gap-3 text-sm">
                                    <span className={`text-lg font-bold ${isPositive ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                                        {isPositive ? '↑' : diff < 0 ? '↓' : '→'} {isPositive ? '+' : ''}{diff.toFixed(1)}pp
                                    </span>
                                    <span className="text-zinc-400">
                                        de <span className="text-zinc-300">{first.accuracy}%</span> ({first.boardName} {first.year})
                                        para <span className="text-zinc-300">{last.accuracy}%</span> ({last.boardName} {last.year})
                                    </span>
                                </div>
                            )
                        })()}
                    </div>
                )}
            </div>

            {/* Board Performance Chart */}
            {selectedBoard === 'all' && boardAggData.length > 1 && (
                <div className="bg-zinc-800/50 rounded-2xl p-4 sm:p-6 border border-zinc-700/50">
                    <h3 className="text-lg font-semibold text-white mb-6">Desempenho por Banca</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={boardAggData}
                                layout="vertical"
                                margin={{ top: 5, right: 50, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#a1a1aa"
                                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                    width={100}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#27272a', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                    itemStyle={{ color: '#e2e8f0', fontSize: '0.875rem' }}
                                    formatter={(value: any, _name: any, props: any) => {
                                        const { total, correct, count } = props.payload
                                        return [`${value}% (${correct}/${total} em ${count} provas)`, 'Acurácia']
                                    }}
                                    labelStyle={{ color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                                />
                                <Bar
                                    dataKey="accuracy"
                                    radius={[0, 4, 4, 0]}
                                    barSize={32}
                                >
                                    {boardAggData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.accuracy >= 80 ? '#22c55e' : entry.accuracy >= 60 ? '#eab308' : '#ef4444'}
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="accuracy"
                                        position="right"
                                        fill="#a1a1aa"
                                        formatter={(val: any) => `${val}%`}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Performance by Area */}
            <div className="bg-zinc-800/50 rounded-2xl p-4 sm:p-6 border border-zinc-700/50">
                <h3 className="text-lg font-semibold text-white mb-6">Desempenho por Grande Área</h3>
                <div className="space-y-4">
                    {disciplineMetrics.map((disc) => (
                        <div key={disc.name} className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-white font-medium">{disc.name}</span>
                                <span className={
                                    disc.accuracy >= 80 ? 'text-green-400' :
                                        disc.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'
                                }>
                                    {disc.accuracy}% <span className="text-zinc-500">({disc.correct}/{disc.total})</span>
                                </span>
                            </div>
                            <div className="h-2 w-full bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${disc.accuracy >= 80 ? 'bg-green-500' :
                                        disc.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${disc.accuracy}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Exams List */}
            <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700/50 overflow-hidden">
                <div className="p-6 border-b border-zinc-700/50">
                    <h3 className="text-lg font-semibold text-white">
                        {selectedBoard === 'all' ? 'Histórico de Provas' : `Histórico — ${selectedBoard}`}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-700/50 bg-zinc-900/20">
                                <th className="text-left py-4 px-6 text-sm font-medium text-zinc-400">Data</th>
                                <th className="text-left py-4 px-6 text-sm font-medium text-zinc-400">Banca/Prova</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Questões</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Acertos</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Desempenho</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExams.map((exam) => (
                                <tr key={exam.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition-colors">
                                    <td className="py-4 px-6 text-zinc-300">{exam.date}</td>
                                    <td className="py-4 px-6">
                                        <div>
                                            <div className="text-white font-medium">{exam.boardName} {exam.year}</div>
                                            {exam.title && <div className="text-xs text-zinc-500">{exam.title}</div>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right text-zinc-300">{exam.totalQuestions}</td>
                                    <td className="py-4 px-6 text-right text-zinc-300">{exam.totalCorrect}</td>
                                    <td className="py-4 px-6 text-right">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${exam.accuracy >= 80 ? 'bg-green-500/10 text-green-400' :
                                            exam.accuracy >= 60 ? 'bg-yellow-500/10 text-yellow-400' :
                                                'bg-red-500/10 text-red-400'
                                            }`}>
                                            {exam.accuracy}%
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => handleDelete(exam.id)}
                                            disabled={deleting === exam.id}
                                            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                                            title="Excluir prova"
                                        >
                                            {deleting === exam.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
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
