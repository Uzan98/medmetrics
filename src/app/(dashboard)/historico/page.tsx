'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton, AccuracyBadge, EmptyState } from '@/components/ui'
import {
    History,
    Edit3,
    Trash2,
    Filter,
    X,
    Save,
    Loader2,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Discipline, Subdiscipline, QuestionLog } from '@/types/database'

interface LogWithRelations extends QuestionLog {
    disciplines: { name: string } | null
    subdisciplines: { name: string } | null
}

export default function HistoricoPage() {
    const [logs, setLogs] = useState<LogWithRelations[]>([])
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [subdisciplines, setSubdisciplines] = useState<Subdiscipline[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Filters
    const [filterDiscipline, setFilterDiscipline] = useState('')
    const [filterDateFrom, setFilterDateFrom] = useState('')
    const [filterDateTo, setFilterDateTo] = useState('')

    // Pagination
    const [page, setPage] = useState(1)
    const pageSize = 15

    // Edit form
    const [editForm, setEditForm] = useState({
        date: '',
        disciplineId: '',
        subdisciplineId: '',
        questionsDone: '',
        correctAnswers: '',
        source: '',
        timeMinutes: '',
        notes: '',
    })

    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        loadLogs()
    }, [filterDiscipline, filterDateFrom, filterDateTo, page])

    async function loadData() {
        try {
            const [disciplinesRes, subdisciplinesRes] = await Promise.all([
                supabase.from('disciplines').select('*').order('name'),
                supabase.from('subdisciplines').select('*').order('name'),
            ])

            if (disciplinesRes.data) setDisciplines(disciplinesRes.data)
            if (subdisciplinesRes.data) setSubdisciplines(subdisciplinesRes.data)
        } catch (err) {
            console.error('Error loading data:', err)
        }
    }

    async function loadLogs() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let query = supabase
                .from('question_logs')
                .select(`
                    *,
                    disciplines(name),
                    subdisciplines(name)
                `)
                .eq('user_id', user.id)
                .order('date', { ascending: false })

            if (filterDiscipline) {
                query = query.eq('discipline_id', Number(filterDiscipline))
            }
            if (filterDateFrom) {
                query = query.gte('date', filterDateFrom)
            }
            if (filterDateTo) {
                query = query.lte('date', filterDateTo)
            }

            const { data, error } = await query

            if (error) throw error
            setLogs(data || [])
        } catch (err) {
            console.error('Error loading logs:', err)
            setError('Erro ao carregar registros')
        } finally {
            setLoading(false)
        }
    }

    function startEdit(log: LogWithRelations) {
        setEditingId(log.id)
        setEditForm({
            date: log.date,
            disciplineId: log.discipline_id?.toString() || '',
            subdisciplineId: log.subdiscipline_id?.toString() || '',
            questionsDone: log.questions_done.toString(),
            correctAnswers: log.correct_answers.toString(),
            source: log.source || '',
            timeMinutes: log.time_minutes?.toString() || '',
            notes: log.notes || '',
        })
    }

    function cancelEdit() {
        setEditingId(null)
        setEditForm({
            date: '',
            disciplineId: '',
            subdisciplineId: '',
            questionsDone: '',
            correctAnswers: '',
            source: '',
            timeMinutes: '',
            notes: '',
        })
    }

    async function saveEdit() {
        if (!editingId) return

        const questionsDone = Number(editForm.questionsDone)
        const correctAnswers = Number(editForm.correctAnswers)

        if (correctAnswers > questionsDone) {
            setError('Acertos não podem ser maiores que questões feitas')
            return
        }

        if (new Date(editForm.date) > new Date()) {
            setError('A data não pode ser futura')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const { error: updateError } = await supabase
                .from('question_logs')
                .update({
                    date: editForm.date,
                    discipline_id: editForm.disciplineId ? Number(editForm.disciplineId) : null,
                    subdiscipline_id: editForm.subdisciplineId ? Number(editForm.subdisciplineId) : null,
                    questions_done: questionsDone,
                    correct_answers: correctAnswers,
                    source: editForm.source || null,
                    time_minutes: editForm.timeMinutes ? Number(editForm.timeMinutes) : null,
                    notes: editForm.notes || null,
                })
                .eq('id', editingId)

            if (updateError) throw updateError

            await loadLogs()
            setSuccess('Registro atualizado com sucesso!')
            cancelEdit()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError('Erro ao salvar alterações')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    async function deleteLog(id: string) {
        try {
            const { error: deleteError } = await supabase
                .from('question_logs')
                .delete()
                .eq('id', id)

            if (deleteError) throw deleteError

            setDeletingId(null)
            await loadLogs()
            setSuccess('Registro excluído com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError('Erro ao excluir registro')
            console.error(err)
        }
    }

    function clearFilters() {
        setFilterDiscipline('')
        setFilterDateFrom('')
        setFilterDateTo('')
        setPage(1)
    }

    const filteredSubdisciplines = editForm.disciplineId
        ? subdisciplines.filter(s => s.discipline_id === Number(editForm.disciplineId))
        : []

    // Pagination
    const totalPages = Math.ceil(logs.length / pageSize)
    const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize)

    if (loading && logs.length === 0) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-12 w-full" />
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Histórico de Registros</h1>
                <p className="text-slate-400">Visualize, edite ou exclua seus registros</p>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <p className="text-red-400">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {success && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-green-400">{success}</p>
                    <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <span className="font-medium text-white">Filtros</span>
                </div>
                <div className="flex flex-wrap gap-4">
                    <select
                        value={filterDiscipline}
                        onChange={(e) => { setFilterDiscipline(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                    >
                        <option value="">Todas as disciplinas</option>
                        {disciplines.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }}
                            className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                            placeholder="De"
                        />
                        <span className="text-slate-500">até</span>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }}
                            className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                            placeholder="Até"
                        />
                    </div>
                    {(filterDiscipline || filterDateFrom || filterDateTo) && (
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-slate-400">
                <span>{logs.length} registro{logs.length !== 1 ? 's' : ''} encontrado{logs.length !== 1 ? 's' : ''}</span>
                {totalPages > 1 && (
                    <span>Página {page} de {totalPages}</span>
                )}
            </div>

            {/* Logs List */}
            {logs.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="Nenhum registro encontrado"
                    description="Não há registros para os filtros selecionados."
                />
            ) : (
                <div className="space-y-3">
                    {paginatedLogs.map((log) => (
                        <div
                            key={log.id}
                            className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all"
                        >
                            {editingId === log.id ? (
                                /* Edit Mode */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Data</label>
                                            <input
                                                type="date"
                                                value={editForm.date}
                                                max={new Date().toISOString().split('T')[0]}
                                                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Disciplina</label>
                                            <select
                                                value={editForm.disciplineId}
                                                onChange={(e) => setEditForm({ ...editForm, disciplineId: e.target.value, subdisciplineId: '' })}
                                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm"
                                            >
                                                <option value="">Selecione</option>
                                                {disciplines.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Subdisciplina</label>
                                            <select
                                                value={editForm.subdisciplineId}
                                                onChange={(e) => setEditForm({ ...editForm, subdisciplineId: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm"
                                                disabled={!editForm.disciplineId}
                                            >
                                                <option value="">Selecione</option>
                                                {filteredSubdisciplines.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Fonte</label>
                                            <input
                                                type="text"
                                                value={editForm.source}
                                                onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Questões</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={editForm.questionsDone}
                                                onChange={(e) => setEditForm({ ...editForm, questionsDone: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Acertos</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={editForm.questionsDone}
                                                value={editForm.correctAnswers}
                                                onChange={(e) => setEditForm({ ...editForm, correctAnswers: e.target.value })}
                                                className={`w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white text-sm ${Number(editForm.correctAnswers) > Number(editForm.questionsDone)
                                                    ? 'border-red-500'
                                                    : 'border-slate-700'
                                                    }`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Tempo (min)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.timeMinutes}
                                                onChange={(e) => setEditForm({ ...editForm, timeMinutes: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm"
                                            />
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <button
                                                onClick={saveEdit}
                                                disabled={saving}
                                                className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                Salvar
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : deletingId === log.id ? (
                                /* Delete Confirmation */
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        <span className="text-red-400">Tem certeza que deseja excluir este registro?</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => deleteLog(log.id)}
                                            className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                                        >
                                            Excluir
                                        </button>
                                        <button
                                            onClick={() => setDeletingId(null)}
                                            className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-white font-medium">
                                                {format(new Date(log.date + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                            </span>
                                            <span className="text-slate-500">•</span>
                                            <span className="text-slate-400">{log.disciplines?.name || 'Sem disciplina'}</span>
                                            {log.subdisciplines?.name && (
                                                <>
                                                    <span className="text-slate-500">•</span>
                                                    <span className="text-slate-500">{log.subdisciplines.name}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-slate-300">
                                                <span className="text-blue-400 font-semibold">{log.questions_done}</span> questões
                                            </span>
                                            <span className="text-slate-300">
                                                <span className="text-green-400 font-semibold">{log.correct_answers}</span> acertos
                                            </span>
                                            <span className="text-slate-300">
                                                <span className="text-red-400 font-semibold">{log.questions_done - log.correct_answers}</span> erros
                                            </span>
                                            <AccuracyBadge
                                                accuracy={log.questions_done > 0 ? (log.correct_answers / log.questions_done) * 100 : 0}
                                                size="sm"
                                            />
                                            {log.source && (
                                                <span className="text-slate-500 italic">{log.source}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => startEdit(log)}
                                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeletingId(log.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = i + 1
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`w-10 h-10 rounded-lg font-medium ${page === pageNum
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    )
}
