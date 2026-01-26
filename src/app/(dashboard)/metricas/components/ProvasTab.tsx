'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Cell, LabelList
} from 'recharts'
import { Loader2, AlertCircle, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ExamMetric {
    id: string
    title: string | null
    date: string
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

export default function ProvasTab() {
    const [loading, setLoading] = useState(true)
    const [exams, setExams] = useState<ExamMetric[]>([])
    const [disciplineMetrics, setDisciplineMetrics] = useState<DisciplineMetric[]>([])
    const [deleting, setDeleting] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

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
            alert('Erro ao excluir prova')
        } finally {
            setDeleting(null)
        }
    }

    async function loadData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch exams with scores and board
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
                // Process Exam Metrics (Line Chart)
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
                        rawDate: exam.date, // for sorting if needed
                        year: exam.year,
                        boardName: (exam.exam_boards as any)?.name || 'Desconhecida',
                        totalQuestions: totalQ,
                        totalCorrect: totalC,
                        accuracy: totalQ > 0 ? Number(((totalC / totalQ) * 100).toFixed(1)) : 0
                    }
                })

                setExams(processedExams)

                // Process Discipline Metrics (Bar Chart)
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
            <div className="flex flex-col items-center justify-center p-12 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <FileText className="w-12 h-12 text-slate-500 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Nenhuma prova registrada</h3>
                <p className="text-slate-400 text-center max-w-md">
                    Registre suas provas na íntegra para visualizar gráficos de evolução e desempenho por área.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Evolution Chart */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-6">Evolução de Acertos (%)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={exams}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                domain={[0, 100]}
                                tickLine={false}
                                axisLine={false}
                                unit="%"
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: any) => [`${Number(value)}%`, 'Acertos']}
                                labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="accuracy"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, fill: '#fff' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Board Performance Chart -- NEW */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-6">Desempenho por Banca</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={Object.values(exams.reduce((acc, curr) => {
                                if (!acc[curr.boardName]) acc[curr.boardName] = { name: curr.boardName, total: 0, correct: 0, accuracy: 0 }
                                acc[curr.boardName].total += curr.totalQuestions
                                acc[curr.boardName].correct += curr.totalCorrect
                                return acc
                            }, {} as Record<string, { name: string, total: number, correct: number, accuracy: number }>)).map(b => ({
                                ...b,
                                accuracy: b.total > 0 ? Number(((b.correct / b.total) * 100).toFixed(1)) : 0
                            })).sort((a, b) => b.accuracy - a.accuracy)}
                            layout="vertical"
                            margin={{ top: 5, right: 50, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                width={100}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#334155', opacity: 0.4 }}
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: any, name: any, props: any) => {
                                    const { total, correct } = props.payload
                                    return [`${value}% (${correct}/${total})`, 'Acurácia']
                                }}
                            />
                            <Bar
                                dataKey="accuracy"
                                radius={[0, 4, 4, 0]}
                                barSize={32}
                            >
                                {
                                    Object.values(exams.reduce((acc, curr) => {
                                        if (!acc[curr.boardName]) acc[curr.boardName] = { name: curr.boardName, total: 0, correct: 0, accuracy: 0 }
                                        acc[curr.boardName].total += curr.totalQuestions
                                        acc[curr.boardName].correct += curr.totalCorrect
                                        return acc
                                    }, {} as Record<string, { name: string, total: number, correct: number, accuracy: number }>)).map(b => ({
                                        ...b,
                                        accuracy: b.total > 0 ? Number(((b.correct / b.total) * 100).toFixed(1)) : 0
                                    })).sort((a, b) => b.accuracy - a.accuracy).map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.accuracy >= 80 ? '#22c55e' : entry.accuracy >= 60 ? '#eab308' : '#ef4444'}
                                        />
                                    ))
                                }
                                <LabelList
                                    dataKey="accuracy"
                                    position="right"
                                    fill="#94a3b8"
                                    formatter={(val: any) => `${val}%`}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Performance by Area */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
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
                                    {disc.accuracy}% <span className="text-slate-500">({disc.correct}/{disc.total})</span>
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
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
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white">Histórico de Provas</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50 bg-slate-900/20">
                                <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Data</th>
                                <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Banca/Prova</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Questões</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Acertos</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Desempenho</th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map((exam) => (
                                <tr key={exam.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                    <td className="py-4 px-6 text-slate-300">{exam.date}</td>
                                    <td className="py-4 px-6">
                                        <div>
                                            <div className="text-white font-medium">{exam.boardName} {exam.year}</div>
                                            {exam.title && <div className="text-xs text-slate-500">{exam.title}</div>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right text-slate-300">{exam.totalQuestions}</td>
                                    <td className="py-4 px-6 text-right text-slate-300">{exam.totalCorrect}</td>
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
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
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
