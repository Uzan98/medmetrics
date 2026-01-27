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
    ChevronUp,
    Image as ImageIcon,
    Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { name: string } | null
    image_urls: string[] | null
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
        notes: '',
        image_urls: [] as string[]
    })
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [previewUrls, setPreviewUrls] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

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

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            const files = Array.from(e.target.files)
            setSelectedFiles(prev => [...prev, ...files])

            // Create previews
            const newPreviews = files.map(file => URL.createObjectURL(file))
            setPreviewUrls(prev => [...prev, ...newPreviews])
        }
    }

    function removeFile(index: number) {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
        setPreviewUrls(prev => {
            // Revoke object URL to avoid memory leaks
            URL.revokeObjectURL(prev[index])
            return prev.filter((_, i) => i !== index)
        })
    }

    function removeExistingImage(index: number) {
        setFormData(prev => ({
            ...prev,
            image_urls: prev.image_urls.filter((_, i) => i !== index)
        }))
    }

    async function uploadImages(userId: string): Promise<string[]> {
        if (selectedFiles.length === 0) return []

        const uploadedUrls: string[] = []
        setUploading(true)

        try {
            for (const file of selectedFiles) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('error-notebook')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('error-notebook')
                    .getPublicUrl(fileName)

                uploadedUrls.push(publicUrl)
            }
        } catch (error) {
            console.error('Error uploading images:', error)
            toast.error('Erro ao fazer upload das imagens')
            throw error
        } finally {
            setUploading(false)
        }

        return uploadedUrls
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Upload new images
            let newImageUrls: string[] = []
            if (selectedFiles.length > 0) {
                newImageUrls = await uploadImages(user.id)
            }

            // Combine existing and new images
            const finalImageUrls = [...formData.image_urls, ...newImageUrls]

            const payload = {
                user_id: user.id,
                discipline_id: Number(formData.discipline_id) || null,
                topic_id: Number(formData.topic_id) || null,
                question_text: formData.question_text,
                answer_text: formData.answer_text,
                notes: formData.notes,
                image_urls: finalImageUrls
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
            notes: '',
            image_urls: []
        })
        setSelectedFiles([])
        setPreviewUrls([])
    }

    function openEdit(entry: ErrorEntry) {
        setEditingEntry(entry)
        setFormData({
            discipline_id: entry.discipline_id?.toString() || '',
            topic_id: entry.topic_id?.toString() || '',
            question_text: entry.question_text,
            answer_text: entry.answer_text,
            notes: entry.notes || '',
            image_urls: entry.image_urls || []
        })
        setSelectedFiles([])
        setPreviewUrls([])
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
            <div className="flex flex-col md:flex-row gap-4 bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 sticky top-4 z-20 shadow-2xl shadow-black/20">
                <div className="flex-1 relative group">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por pergunta, notas ou disciplina..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={disciplineFilter}
                        onChange={(e) => setDisciplineFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all appearance-none"
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
                    <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-400 font-medium animate-pulse">Carregando seus flashcards...</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="text-center py-20 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/5 border-dashed">
                    <div className="bg-indigo-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-4 ring-indigo-500/5">
                        <BookOpen className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Nenhum erro registrado</h3>
                    <p className="text-slate-400 max-w-md mx-auto mb-8">Comece a registrar seus erros para criar um banco de conhecimento personalizado.</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors border-b border-indigo-500/30 hover:border-indigo-500"
                    >
                        Criar primeiro flashcard
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredEntries.map(entry => (
                        <ErrorCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => handleDelete(entry.id)} />
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-indigo-500/10">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-xl">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingEntry ? <Edit className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                                {editingEntry ? 'Editar Flashcard' : 'Novo Flashcard'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-1 rounded-lg hover:bg-white/10">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Disciplina</label>
                                    <select
                                        required
                                        value={formData.discipline_id}
                                        onChange={(e) => setFormData({ ...formData, discipline_id: e.target.value, topic_id: '' })}
                                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-500"
                                    >
                                        <option value="">Selecione...</option>
                                        {disciplines.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assunto</label>
                                    <select
                                        value={formData.topic_id}
                                        onChange={(e) => setFormData({ ...formData, topic_id: e.target.value })}
                                        disabled={!formData.discipline_id}
                                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
                                    >
                                        <option value="">Selecione...</option>
                                        {topics.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pergunta / Conceito</label>
                                <div className="relative">
                                    <textarea
                                        required
                                        rows={3}
                                        value={formData.question_text}
                                        onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                                        placeholder="Ex: Qual o tratamento de primeira linha para..."
                                    />
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resposta / Explicação</label>
                                <div className="relative">
                                    <textarea
                                        required
                                        rows={4}
                                        value={formData.answer_text}
                                        onChange={(e) => setFormData({ ...formData, answer_text: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 resize-none"
                                        placeholder="A resposta correta é..."
                                    />
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notas Adicionais</label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none"
                                    placeholder="Dica: Lembrar da regra..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Imagens</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                    {/* Existing Images */}
                                    {formData.image_urls.map((url, index) => (
                                        <div key={`existing-${index}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700/50 group">
                                            <Image
                                                src={url}
                                                alt={`Imagem ${index + 1}`}
                                                fill
                                                className="object-cover transition-transform group-hover:scale-110"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeExistingImage(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 text-center backdrop-blur-sm">
                                                Salva
                                            </div>
                                        </div>
                                    ))}

                                    {/* New File Previews */}
                                    {previewUrls.map((url, index) => (
                                        <div key={`new-${index}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700/50 group">
                                            <Image
                                                src={url}
                                                alt={`Preview ${index + 1}`}
                                                fill
                                                className="object-cover transition-transform group-hover:scale-110"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}

                                    <label className="aspect-square rounded-xl border-2 border-dashed border-slate-700/50 hover:border-indigo-500 hover:bg-slate-800/50 cursor-pointer flex flex-col items-center justify-center transition-all group">
                                        <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-indigo-500/20 transition-colors mb-2">
                                            <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-indigo-400" />
                                        </div>
                                        <span className="text-xs text-slate-500 group-hover:text-indigo-400 font-medium">Adicionar</span>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 text-slate-300 hover:text-white font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                                >
                                    {saving && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
                                    {uploading ? 'Enviando...' : 'Salvar Flashcard'}
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
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    return (
        <>
            <div className={`
                relative bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 transition-all duration-300 group
                flex flex-col h-full
                ${showAnswer ? 'ring-1 ring-emerald-500/50 bg-emerald-900/10' : 'hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/10'}
            `}>
                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-wrap gap-2">
                            {entry.disciplines && (
                                <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
                                    {entry.disciplines.name}
                                </span>
                            )}
                            {entry.topics && (
                                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-700/50">
                                    {entry.topics.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex-1">
                        <h3 className="text-white font-semibold text-lg leading-relaxed">{entry.question_text}</h3>
                    </div>

                    {/* Image Gallery */}
                    {entry.image_urls && entry.image_urls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            {entry.image_urls.map((url, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => { e.stopPropagation(); setSelectedImage(url); }}
                                    className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10 hover:border-indigo-500 transition-colors group/img"
                                >
                                    <Image
                                        src={url}
                                        alt={`Imagem ${i + 1}`}
                                        fill
                                        className="object-cover group-hover/img:scale-110 transition-transform duration-500"
                                    />
                                </button>
                            ))}
                        </div>
                    )}

                    {showAnswer ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-xl rounded-full -mr-8 -mt-8" />
                                <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Check className="w-3 h-3" /> Resposta
                                </h4>
                                <p className="text-slate-200 whitespace-pre-line text-sm leading-relaxed">{entry.answer_text}</p>
                            </div>
                            {entry.notes && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden">
                                    <h4 className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <BrainCircuit className="w-3 h-3" /> Notas
                                    </h4>
                                    <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{entry.notes}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAnswer(true)}
                            className="w-full py-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white font-medium text-sm transition-all border border-slate-700/50 border-dashed hover:border-indigo-500/50 flex items-center justify-center gap-2 group/btn"
                        >
                            <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            Revelar Resposta
                        </button>
                    )}

                    {showAnswer && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowAnswer(false); }}
                            className="w-full mt-4 py-2 text-xs text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <ChevronUp className="w-3 h-3" /> Ocultar
                        </button>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative w-full max-w-5xl h-full flex items-center justify-center">
                        <Image
                            src={selectedImage}
                            alt="Visualização"
                            width={1200}
                            height={800}
                            className="object-contain max-h-[95vh] w-auto h-auto rounded-lg shadow-2xl"
                        />
                        <button
                            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
