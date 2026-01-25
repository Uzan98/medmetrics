'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Loader2,
    FileText,
    Trash2,
    Search,
    Filter,
    Plus,
    Calendar,
    GraduationCap
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { toast } from 'sonner'
import { ExamBoard } from '@/types/database'

interface ExamMetric {
    id: string
    title: string | null
    date: string
    year: number
    boardName: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
    boardId: number
}

export default function ExamsPage() {
    const [loading, setLoading] = useState(true)
    const [exams, setExams] = useState<ExamMetric[]>([])
    const [filteredExams, setFilteredExams] = useState<ExamMetric[]>([])
    const [boards, setBoards] = useState<any[]>([])
    const [deleting, setDeleting] = useState<string | null>(null)
    const supabase = createClient()

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedBoard, setSelectedBoard] = useState<string>('all')
    const [selectedYear, setSelectedYear] = useState<string>('all')

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        filterData()
    }, [searchTerm, selectedBoard, selectedYear, exams])

    async function loadData() {
        setLoading(true)
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
                    board_id,
                    exam_boards(id, name),
                    exam_scores(questions_total, questions_correct)
                `)
                .eq('user_id', user.id)
                .order('date', { ascending: false })

            if (error) throw error

            if (examsData) {
                const processed = examsData.map(exam => {
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
                        title: exam.title || null,
                        date: exam.date,
                        year: exam.year,
                        boardName: (exam.exam_boards as any)?.name || 'Desconhecida',
                        boardId: (exam.exam_boards as any)?.id,
                        totalQuestions: totalQ,
                        totalCorrect: totalC,
                        accuracy: totalQ > 0 ? Number(((totalC / totalQ) * 100).toFixed(1)) : 0
                    }
                })
                setExams(processed)

                // Extract unique boards for filter
                const uniqueBoards = Array.from(new Set(processed.map(e => JSON.stringify({ id: e.boardId, name: e.boardName }))))
                    .map(s => JSON.parse(s))
                    .sort((a, b) => a.name.localeCompare(b.name))
                setBoards(uniqueBoards)
            }
        } catch (err) {
            console.error('Error loading exams:', err)
            toast.error('Erro ao carregar provas')
        } finally {
            setLoading(false)
        }
    }

    function filterData() {
        let filtered = [...exams]

        if (searchTerm) {
            const lower = searchTerm.toLowerCase()
            filtered = filtered.filter(e =>
                (e.title && e.title.toLowerCase().includes(lower)) ||
                e.boardName.toLowerCase().includes(lower)
            )
        }

        if (selectedBoard !== 'all') {
            filtered = filtered.filter(e => e.boardId === Number(selectedBoard))
        }

        if (selectedYear !== 'all') {
            filtered = filtered.filter(e => e.year === Number(selectedYear))
        }

        setFilteredExams(filtered)
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta prova? Todos os dados associados serão perdidos.')) return

        setDeleting(id)
        try {
            await supabase.from('exam_scores').delete().eq('exam_id', id)
            const { error } = await supabase.from('exams').delete().eq('id', id)
            if (error) throw error

            toast.success('Prova excluída com sucesso')
            loadData() // Reload to refresh list
        } catch (err) {
            console.error('Error deleting exam:', err)
            toast.error('Erro ao excluir prova')
        } finally {
            setDeleting(null)
        }
    }

    // Extract unique years
    const uniqueYears = Array.from(new Set(exams.map(e => e.year))).sort((a, b) => b - a)

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-500" />
                        Minhas Provas
                    </h1>
                    <p className="text-slate-400">Gerencie suas provas na íntegra e simulados</p>
                </div>

                <Link
                    href="/registrar?mode=exam"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nova Prova
                </Link>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="md:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar prova..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <select
                        value={selectedBoard}
                        onChange={(e) => setSelectedBoard(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">Todas as Bancas</option>
                        {boards.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">Todos os Anos</option>
                        {uniqueYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : filteredExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
                    <FileText className="w-12 h-12 text-slate-600 mb-4" />
                    <h3 className="text-xl font-medium text-slate-300 mb-2">Nenhuma prova encontrada</h3>
                    <p className="text-slate-500 text-center max-w-sm mb-6">
                        {searchTerm || selectedBoard !== 'all' || selectedYear !== 'all'
                            ? 'Tente ajustar os filtros para encontrar o que procura.'
                            : 'Registre sua primeira prova na íntegra para começar a acompanhar seu desempenho.'}
                    </p>
                    {filteredExams.length === 0 && !searchTerm && selectedBoard === 'all' && selectedYear === 'all' && (
                        <Link
                            href="/registrar?mode=exam"
                            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                            Registrar agora
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredExams.map(exam => (
                        <div key={exam.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold
                                        ${exam.accuracy >= 80 ? 'bg-green-500/20 text-green-400' :
                                            exam.accuracy >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'}
                                    `}>
                                        {Math.round(exam.accuracy)}%
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            {exam.boardName} <span className="text-slate-500 font-normal">{exam.year}</span>
                                        </h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 mt-1">
                                            {exam.title && <span className="text-slate-300">{exam.title}</span>}
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(exam.date), 'dd/MM/yyyy')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <GraduationCap className="w-3 h-3" />
                                                {exam.totalCorrect}/{exam.totalQuestions} acertos
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                    <button
                                        onClick={() => handleDelete(exam.id)}
                                        disabled={deleting === exam.id}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Excluir"
                                    >
                                        {deleting === exam.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
