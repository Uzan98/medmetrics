'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import {
    Plus,
    Search,
    Filter,
    Trash2,
    Edit,
    Eye,
    Check,
    X,
    BookOpen,
    BrainCircuit,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { name: string } | null
}

type Discipline = Database['public']['Tables']['disciplines']['Row']
type Topic = Database['public']['Tables']['topics']['Row']

export default function ErrorNotebookPage() {
    const supabase = createClient()
    const [entries, setEntries] = useState<ErrorEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [topics, setTopics] = useState<Topic[]>([])

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [disciplineFilter, setDisciplineFilter] = useState<number | 'all'>('all')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<ErrorEntry | null>(null)
    const [formData, setFormData] = useState({
        discipline_id: '',
        topic_id: '',
        question_text: '',
        answer_text: '',
        notes: ''
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Load Entries
            const { data: errorEntries, error } = await supabase
                .from('error_notebook')
                .select('*, disciplines(name), topics(name)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            if (errorEntries) setEntries(errorEntries as any)

            // Load Disciplines
            const { data: discData } = await supabase
                .from('disciplines')
                .select('*')
                .order('name')
            if (discData) setDisciplines(discData)

        } catch (error) {
            console.error('Error loading data:', error)
            toast.error('Erro ao carregar caderno de erros')
        } finally {
            setLoading(false)
        }
    }

    // Load topics when discipline changes in form
    useEffect(() => {
        if (formData.discipline_id) {
            loadTopics(Number(formData.discipline_id))
        } else {
            setTopics([])
        }
    }, [formData.discipline_id])

    async function loadTopics(disciplineId: number) {
        // Get topics via subdisciplines relationship
        const { data: subData } = await supabase
            .from('subdisciplines')
            .select('id, topics(id, name)')
            .eq('discipline_id', disciplineId)

        if (subData) {
            const allTopics = subData.flatMap(s => s.topics).sort((a: any, b: any) => a.name.localeCompare(b.name))
            setTopics(allTopics as any)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const payload = {
                user_id: user.id,
                discipline_id: Number(formData.discipline_id) || null,
                topic_id: Number(formData.topic_id) || null,
                question_text: formData.question_text,
                answer_text: formData.answer_text,
                notes: formData.notes
            }

            if (editingEntry) {
                const { error } = await supabase
                    .from('error_notebook')
                    .update(payload)
                    .eq('id', editingEntry.id)
                if (error) throw error
                toast.success('Erro atualizado com sucesso!')
            } else {
                const { error } = await supabase
                    .from('error_notebook')
                    .insert([payload])
                if (error) throw error
                toast.success('Erro registrado com sucesso!')
            }

            setIsModalOpen(false)
            setEditingEntry(null)
            resetForm()
            loadData()

        } catch (error) {
            console.error('Error saving:', error)
            toast.error('Erro ao salvar registro')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir este registro?')) return

        try {
            const { error } = await supabase
                .from('error_notebook')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Registro excluído')
            setEntries(entries.filter(e => e.id !== id))
        } catch (error) {
            console.error('Error deleting:', error)
            toast.error('Erro ao excluir registro')
        }
    }

    function resetForm() {
        setFormData({
            discipline_id: '',
            topic_id: '',
            question_text: '',
            answer_text: '',
            notes: ''
        })
    }

    function openEdit(entry: ErrorEntry) {
        setEditingEntry(entry)
        setFormData({
            discipline_id: entry.discipline_id?.toString() || '',
            topic_id: entry.topic_id?.toString() || '',
            question_text: entry.question_text,
            answer_text: entry.answer_text,
            notes: entry.notes || ''
        })
        setIsModalOpen(true)
    }

    const filteredEntries = entries.filter(entry => {
        const matchesSearch = entry.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.disciplines?.name.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesDiscipline = disciplineFilter === 'all' || entry.discipline_id === disciplineFilter

        return matchesSearch && matchesDiscipline
    })

    return (
        <div className="p-8 space-y-8 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Caderno de Erros</h1>
                    <p className="text-slate-400">Registre e revise suas dúvidas e erros para consolidar o aprendizado.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingEntry(null)
                        resetForm()
                        setIsModalOpen(true)
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Novo Registro
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                        type="text"
                        placeholder="Buscar por pergunta, notas ou disciplina..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={disciplineFilter}
                        onChange={(e) => setDisciplineFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="all">Todas as Disciplinas</option>
                        {disciplines.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-500">Carregando seus registros...</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                    <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Nenhum erro registrado</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">Comece a registrar seus erros para criar um banco de conhecimento personalizado.</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                        Criar primeiro registro
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredEntries.map(entry => (
                        <ErrorCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => handleDelete(entry.id)} />
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-xl">
                            <h2 className="text-xl font-bold text-white">
                                {editingEntry ? 'Editar Registro' : 'Novo Registro de Erro'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Disciplina</label>
                                    <select
                                        required
                                        value={formData.discipline_id}
                                        onChange={(e) => setFormData({ ...formData, discipline_id: e.target.value, topic_id: '' })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Selecione...</option>
                                        {disciplines.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Assunto (Opcional)</label>
                                    <select
                                        value={formData.topic_id}
                                        onChange={(e) => setFormData({ ...formData, topic_id: e.target.value })}
                                        disabled={!formData.discipline_id}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                    >
                                        <option value="">Selecione...</option>
                                        {topics.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Pergunta / Conceito Errado</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.question_text}
                                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
                                    placeholder="Ex: Qual o tratamento de primeira linha para..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Resposta Correta / Explicação</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.answer_text}
                                    onChange={(e) => setFormData({ ...formData, answer_text: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 resize-none"
                                    placeholder="A resposta correta é..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Notas Adicionais (Mnemônicos, dicas...)</label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 resize-none"
                                    placeholder="Dica: Lembrar da regra..."
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {saving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                                    Salvar Registro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function ErrorCard({ entry, onEdit, onDelete }: { entry: ErrorEntry, onEdit: () => void, onDelete: () => void }) {
    const [showAnswer, setShowAnswer] = useState(false)

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all group">
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-2">
                        {entry.disciplines && (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                                {entry.disciplines.name}
                            </span>
                        )}
                        {entry.topics && (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium border border-slate-700">
                                {entry.topics.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <h3 className="text-white font-medium text-lg leading-snug">{entry.question_text}</h3>
                </div>

                {showAnswer ? (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                            <h4 className="text-green-400 text-sm font-bold mb-1 flex items-center gap-2">
                                <Check className="w-4 h-4" /> Resposta
                            </h4>
                            <p className="text-slate-300 whitespace-pre-line">{entry.answer_text}</p>
                        </div>
                        {entry.notes && (
                            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4">
                                <h4 className="text-yellow-400 text-sm font-bold mb-1 flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4" /> Notas
                                </h4>
                                <p className="text-slate-300 text-sm whitespace-pre-line">{entry.notes}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-medium text-sm transition-all border border-slate-700 border-dashed flex items-center justify-center gap-2"
                    >
                        <Eye className="w-4 h-4" />
                        Ver Resposta
                    </button>
                )}

                {showAnswer && (
                    <button
                        onClick={() => setShowAnswer(false)}
                        className="w-full mt-4 py-2 text-xs text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1"
                    >
                        <ChevronUp className="w-3 h-3" /> Ocultar Resposta
                    </button>
                )}
            </div>
            <div className="bg-slate-950/30 px-5 py-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                <span>Adicionado em {new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                <span>Revisado {entry.review_count} vezes</span>
            </div>
        </div>
    )
}
