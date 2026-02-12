'use client'

import { useState, useEffect, useCallback } from 'react'
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
    Loader2,
    Play,
    Flame,
    Zap,
    Target,
    Trophy,
    Sparkles,
    Clock,
    SlidersHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { StudyMode } from './StudyMode'
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { name: string } | null
    image_urls: string[] | null
    error_type: 'knowledge_gap' | 'interpretation' | 'distraction' | 'reasoning' | null
    action_item: string | null
}

type Discipline = Database['public']['Tables']['disciplines']['Row']
type Topic = Database['public']['Tables']['topics']['Row']

interface UserStudyStats {
    current_streak: number
    longest_streak: number
    total_xp: number
    total_cards_reviewed: number
    last_study_date: string | null
}

export default function ErrorNotebookPage() {
    const supabase = createClient()
    const [entries, setEntries] = useState<ErrorEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [topics, setTopics] = useState<Topic[]>([])

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [disciplineFilter, setDisciplineFilter] = useState<number | 'all'>('all')
    const [errorTypeFilter, setErrorTypeFilter] = useState<'all' | 'knowledge_gap' | 'interpretation' | 'distraction' | 'reasoning'>('all')
    const [showOnlyPending, setShowOnlyPending] = useState(false)
    const [showFilters, setShowFilters] = useState(false)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<ErrorEntry | null>(null)
    const [formData, setFormData] = useState({
        discipline_id: '',
        topic_id: '',
        question_text: '',
        answer_text: '',
        notes: '',
        image_urls: [] as string[],
        error_type: '' as ErrorEntry['error_type'] | '',
        action_item: ''
    })
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [previewUrls, setPreviewUrls] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Study Mode State
    const [showStudyMode, setShowStudyMode] = useState(false)
    const [showStudySetup, setShowStudySetup] = useState(false)
    const [studyDiscipline, setStudyDiscipline] = useState<number | 'all'>('all')
    const [userStats, setUserStats] = useState<UserStudyStats | null>(null)

    // Pagination
    const ITEMS_PER_PAGE = 20
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

    // Delete Confirmation Modal
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

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

            // Load User Study Stats
            const { data: statsData } = await supabase
                .from('user_study_stats')
                .select('*')
                .eq('user_id', user.id)
                .single()
            if (statsData) setUserStats(statsData as UserStudyStats)

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
                image_urls: finalImageUrls,
                error_type: formData.error_type || null,
                action_item: formData.action_item
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

            closeModal()
            loadData()

        } catch (error) {
            console.error('Error saving:', error)
            toast.error('Erro ao salvar registro')
        } finally {
            setSaving(false)
        }
    }

    // Fix #3: Clean up Object URLs on modal close to prevent memory leaks
    function closeModal() {
        previewUrls.forEach(url => URL.revokeObjectURL(url))
        setIsModalOpen(false)
        setEditingEntry(null)
        resetForm()
    }

    // Fix #8: Custom delete with modal instead of confirm()
    async function handleDelete(id: string) {
        setDeleting(true)
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
        } finally {
            setDeleting(false)
            setDeleteTarget(null)
        }
    }

    function resetForm() {
        setFormData({
            discipline_id: '',
            topic_id: '',
            question_text: '',
            answer_text: '',
            notes: '',
            image_urls: [],
            error_type: '',
            action_item: ''
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
            image_urls: entry.image_urls || [],
            error_type: entry.error_type || '',
            action_item: entry.action_item || ''
        })
        setSelectedFiles([])
        setPreviewUrls([])
        setIsModalOpen(true)
    }

    // Calculate pending reviews (cards due for review today or earlier)
    const today = new Date().toISOString().split('T')[0]
    const pendingEntries = entries.filter(entry => {
        const nextReview = (entry as any).next_review_date
        return !nextReview || nextReview <= today
    })
    const pendingCount = pendingEntries.length

    const filteredEntries = entries.filter(entry => {
        const matchesSearch = entry.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.disciplines?.name.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesDiscipline = disciplineFilter === 'all' || entry.discipline_id === disciplineFilter

        const matchesErrorType = errorTypeFilter === 'all' || entry.error_type === errorTypeFilter

        const matchesPending = !showOnlyPending || pendingEntries.some(p => p.id === entry.id)

        return matchesSearch && matchesDiscipline && matchesErrorType && matchesPending
    })

    // Fix #9: Pagination
    const paginatedEntries = filteredEntries.slice(0, visibleCount)
    const hasMore = filteredEntries.length > visibleCount

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE)
    }, [searchTerm, disciplineFilter, errorTypeFilter, showOnlyPending])

    return (
        <>
            {/* Study Mode */}
            {showStudyMode && (
                <StudyMode
                    entries={showOnlyPending ? pendingEntries : entries}
                    disciplineId={studyDiscipline}
                    onClose={() => {
                        setShowStudyMode(false)
                        setShowOnlyPending(false)
                        loadData()
                    }}
                    onSessionComplete={(stats) => {
                        loadData()
                    }}
                />
            )}

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in pb-24">
                {/* Gamification Header */}
                <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl p-6 border border-white/10 relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-500/10 to-purple-500/5 rounded-full blur-3xl" />

                    <div className="relative z-10">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            {/* Title & Stats */}
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                        <BookOpen className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-black text-white">Caderno de Erros</h1>
                                        <p className="text-slate-400 text-sm">Transforme erros em conhecimento!</p>
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="flex flex-wrap gap-4 mt-4">
                                    {/* Streak */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-xl border border-orange-500/30">
                                        <Flame className="w-5 h-5 text-orange-400" />
                                        <div>
                                            <span className="text-xl font-black text-white">{userStats?.current_streak || 0}</span>
                                            <span className="text-xs text-orange-300 ml-1">dias</span>
                                        </div>
                                    </div>

                                    {/* XP */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                                        <Zap className="w-5 h-5 text-yellow-400" />
                                        <div>
                                            <span className="text-xl font-black text-white">{userStats?.total_xp || 0}</span>
                                            <span className="text-xs text-yellow-300 ml-1">XP</span>
                                        </div>
                                    </div>

                                    {/* Cards */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                                        <Target className="w-5 h-5 text-emerald-400" />
                                        <div>
                                            <span className="text-xl font-black text-white">{userStats?.total_cards_reviewed || 0}</span>
                                            <span className="text-xs text-emerald-300 ml-1">revisados</span>
                                        </div>
                                    </div>

                                    {/* Pending Reviews - Highlighted */}
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${pendingCount > 0
                                        ? 'bg-rose-500/20 border-rose-500/30 animate-pulse'
                                        : 'bg-blue-500/20 border-blue-500/30'
                                        }`}>
                                        <BookOpen className={`w-5 h-5 ${pendingCount > 0 ? 'text-rose-400' : 'text-blue-400'}`} />
                                        <div>
                                            <span className="text-xl font-black text-white">{pendingCount}</span>
                                            <span className={`text-xs ml-1 ${pendingCount > 0 ? 'text-rose-300' : 'text-blue-300'}`}>
                                                {pendingCount === 1 ? 'pendente' : 'pendentes'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setShowStudySetup(true)}
                                    disabled={entries.length === 0}
                                    className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    <span>Iniciar Estudo</span>
                                    <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                                </button>

                                {/* Quick Review Pending */}
                                {pendingCount > 0 && (
                                    <button
                                        onClick={() => {
                                            setStudyDiscipline('all')
                                            setShowOnlyPending(true)
                                            setShowStudyMode(true)
                                        }}
                                        className="px-5 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 flex items-center justify-center gap-2 group animate-pulse"
                                    >
                                        <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        <span>Revisar {pendingCount}</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        setEditingEntry(null)
                                        resetForm()
                                        setIsModalOpen(true)
                                    }}
                                    className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all border border-white/20 hover:border-white/30 flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Novo Card
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Study Setup Modal */}
                {showStudySetup && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" style={{ zIndex: 100 }}>
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
                            <div className="text-center mb-8">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                                    <Play className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2">Iniciar Sessão de Estudo</h2>
                                <p className="text-slate-400">Escolha uma disciplina ou estude todos os cards</p>
                            </div>

                            <div className="space-y-3 mb-8">
                                <button
                                    onClick={() => {
                                        setStudyDiscipline('all')
                                        setShowStudySetup(false)
                                        setShowStudyMode(true)
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl text-white font-semibold transition-all flex items-center justify-center gap-3"
                                >
                                    <Sparkles className="w-5 h-5 text-indigo-400" />
                                    Todos os Cards ({entries.length})
                                </button>

                                {disciplines.map(disc => {
                                    const count = entries.filter(e => e.discipline_id === disc.id).length
                                    if (count === 0) return null
                                    return (
                                        <button
                                            key={disc.id}
                                            onClick={() => {
                                                setStudyDiscipline(disc.id)
                                                setShowStudySetup(false)
                                                setShowStudyMode(true)
                                            }}
                                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white font-medium transition-all flex items-center justify-between px-4"
                                        >
                                            <span>{disc.name}</span>
                                            <span className="text-slate-500">{count} cards</span>
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={() => setShowStudySetup(false)}
                                className="w-full py-3 text-slate-400 hover:text-white transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters — Fix #5: collapsible on mobile */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 sticky top-4 z-20 shadow-2xl shadow-black/20">
                    <div className="flex gap-3 p-3 sm:p-4">
                        <div className="flex-1 relative group">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar cards..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`md:hidden px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${showFilters || disciplineFilter !== 'all' || errorTypeFilter !== 'all' || showOnlyPending
                                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                : 'bg-slate-900/50 border-slate-700/50 text-slate-400'
                                }`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            {(disciplineFilter !== 'all' || errorTypeFilter !== 'all' || showOnlyPending) && (
                                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            )}
                        </button>
                    </div>
                    <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-3 px-3 sm:px-4 pb-3 sm:pb-4 border-t border-white/5 md:border-t-0 pt-3 md:pt-0`}>
                        <div className="w-full md:w-48">
                            <select
                                value={disciplineFilter}
                                onChange={(e) => setDisciplineFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all appearance-none"
                            >
                                <option value="all">Todas Disciplinas</option>
                                {disciplines.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                value={errorTypeFilter}
                                onChange={(e) => setErrorTypeFilter(e.target.value as any)}
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all appearance-none"
                            >
                                <option value="all">Todos Tipos de Erro</option>
                                <option value="knowledge_gap">🔴 Lacuna de Conteúdo</option>
                                <option value="interpretation">🟠 Falha de Interpretação</option>
                                <option value="distraction">🟡 Falta de Atenção</option>
                                <option value="reasoning">🔵 Raciocínio Incorreto</option>
                            </select>
                        </div>
                        <button
                            onClick={() => setShowOnlyPending(!showOnlyPending)}
                            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 whitespace-nowrap ${showOnlyPending
                                ? 'bg-rose-500/30 border border-rose-500/50 text-rose-300'
                                : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                                }`}
                        >
                            <BookOpen className="w-4 h-4" />
                            Só Pendentes
                            {showOnlyPending && <span className="font-bold">({pendingCount})</span>}
                        </button>
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
                    <div className="space-y-2">
                        {/* Fix #7: Result counter */}
                        <div className="flex items-center justify-between px-1">
                            <p className="text-sm text-slate-500">
                                {filteredEntries.length === entries.length
                                    ? <span><span className="font-semibold text-slate-300">{entries.length}</span> cards</span>
                                    : <span><span className="font-semibold text-slate-300">{filteredEntries.length}</span> de {entries.length} cards</span>
                                }
                            </p>
                            {(disciplineFilter !== 'all' || errorTypeFilter !== 'all' || showOnlyPending || searchTerm) && (
                                <button
                                    onClick={() => { setSearchTerm(''); setDisciplineFilter('all'); setErrorTypeFilter('all'); setShowOnlyPending(false) }}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>

                        {/* Table Header */}
                        <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                            <div className="col-span-2">Disciplina</div>
                            <div className="col-span-4">Pergunta</div>
                            <div className="col-span-2">Motivo do Erro</div>
                            <div className="col-span-2">Revisão</div>
                            <div className="col-span-2 text-right">Ações</div>
                        </div>

                        {/* Rows — Fix #9: Paginated */}
                        {paginatedEntries.map(entry => (
                            <ErrorRow key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => setDeleteTarget(entry.id)} />
                        ))}

                        {/* Fix #9: Load more button */}
                        {hasMore && (
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-slate-300 hover:text-white font-medium transition-all flex items-center gap-2"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                    Carregar mais ({filteredEntries.length - visibleCount} restantes)
                                </button>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Fix #8: Custom Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 110 }}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7 text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Excluir Flashcard</h3>
                        <p className="text-slate-400 text-sm text-center mb-6">Tem certeza que deseja excluir este card? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 font-medium transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteTarget)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Moved outside to escape transform context */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 100 }}>
                        <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-indigo-500/10">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {editingEntry ? <Edit className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                                    {editingEntry ? 'Editar Flashcard' : 'Novo Flashcard'}
                                </h2>
                                <button onClick={closeModal} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-1 rounded-lg hover:bg-white/10">
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo de Erro (Metacognição)</label>
                                        <select
                                            value={formData.error_type || ''}
                                            onChange={(e) => setFormData({ ...formData, error_type: e.target.value as any })}
                                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
                                        >
                                            <option value="">Selecione o motivo...</option>
                                            <option value="knowledge_gap">Lacuna de Conteúdo (Não sabia)</option>
                                            <option value="interpretation">Falha de Interpretação (Não entendi)</option>
                                            <option value="distraction">Falta de Atenção (Distração/Li errado)</option>
                                            <option value="reasoning">Erro de Raciocínio (Conexão errada)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ação Corretiva</label>
                                        <input
                                            type="text"
                                            value={formData.action_item}
                                            onChange={(e) => setFormData({ ...formData, action_item: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="O que você fará diferente?"
                                        />
                                    </div>
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
                                        onClick={closeModal}
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
                )
            }
        </>
    )
}

// Helper to get discipline styles - Bolder, More Vibrant
function getDisciplineStyles(name: string | undefined): {
    accent: string,       // Bold accent color for left border
    bg: string,           // Card background
    iconBg: string,       // Icon background
    icon: string,         // Icon color
    badge: string,        // Topic badge
    glow: string          // Hover glow effect
} {
    if (!name) return {
        accent: 'bg-indigo-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-indigo-500/20',
        icon: 'text-indigo-400',
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        glow: 'hover:shadow-indigo-500/20'
    }

    const n = name.toLowerCase()

    if (n.includes('clínica') || n.includes('clinica')) return {
        accent: 'bg-gradient-to-b from-amber-400 to-orange-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-amber-500/20',
        icon: 'text-amber-400',
        badge: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
        glow: 'hover:shadow-amber-500/20'
    }

    if (n.includes('cirurgia')) return {
        accent: 'bg-gradient-to-b from-emerald-400 to-teal-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-emerald-500/20',
        icon: 'text-emerald-400',
        badge: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50',
        glow: 'hover:shadow-emerald-500/20'
    }

    if (n.includes('pediatria')) return {
        accent: 'bg-gradient-to-b from-cyan-400 to-blue-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-cyan-500/20',
        icon: 'text-cyan-400',
        badge: 'bg-cyan-950/50 text-cyan-300 border-cyan-800/50',
        glow: 'hover:shadow-cyan-500/20'
    }

    if (n.includes('ginecologia') || n.includes('obstetrícia')) return {
        accent: 'bg-gradient-to-b from-pink-400 to-rose-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-pink-500/20',
        icon: 'text-pink-400',
        badge: 'bg-pink-950/50 text-pink-300 border-pink-800/50',
        glow: 'hover:shadow-pink-500/20'
    }

    if (n.includes('preventiva') || n.includes('coletiva')) return {
        accent: 'bg-gradient-to-b from-violet-400 to-purple-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-violet-500/20',
        icon: 'text-violet-400',
        badge: 'bg-violet-950/50 text-violet-300 border-violet-800/50',
        glow: 'hover:shadow-violet-500/20'
    }

    return {
        accent: 'bg-gradient-to-b from-indigo-400 to-blue-500',
        bg: 'bg-slate-900',
        iconBg: 'bg-indigo-500/20',
        icon: 'text-indigo-400',
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        glow: 'hover:shadow-indigo-500/20'
    }
}

function ErrorRow({ entry, onEdit, onDelete }: { entry: ErrorEntry, onEdit: () => void, onDelete: () => void }) {
    const [expanded, setExpanded] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    const styles = getDisciplineStyles(entry.disciplines?.name);

    return (
        <>
            <div className={`
                bg-slate-900/50 border border-slate-800/80 rounded-xl overflow-hidden transition-all duration-300
                hover:bg-slate-900 hover:border-slate-700 group
                ${expanded ? 'ring-1 ring-white/10' : ''}
            `}>
                {/* Main Row - Always visible */}
                <div
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-4 items-center cursor-pointer"
                    onClick={() => setExpanded(!expanded)}
                >
                    {/* Discipline & Topic */}
                    <div className="col-span-2 flex items-center gap-3">
                        <div className={`w-1.5 h-12 rounded-full ${styles.accent} flex-shrink-0`} />
                        <div className="min-w-0">
                            <p className={`font-semibold text-sm ${styles.icon} truncate`}>
                                {entry.disciplines?.name || 'Sem disciplina'}
                            </p>
                            {entry.topics && (
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                    {entry.topics.name}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Question */}
                    <div className="md:col-span-4">
                        <p className="text-slate-200 text-sm line-clamp-2 group-hover:text-white transition-colors">
                            {entry.question_text}
                        </p>
                    </div>

                    {/* Error Type */}
                    <div className="md:col-span-2 flex items-center gap-2">
                        {entry.error_type ? (
                            <div className={`
                                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                                ${entry.error_type === 'knowledge_gap' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                    entry.error_type === 'interpretation' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                                        entry.error_type === 'distraction' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                            'bg-blue-500/20 text-blue-300 border border-blue-500/30'}
                            `}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.error_type === 'knowledge_gap' ? 'bg-red-400' :
                                    entry.error_type === 'interpretation' ? 'bg-orange-400' :
                                        entry.error_type === 'distraction' ? 'bg-yellow-400' : 'bg-blue-400'
                                    }`} />
                                <span className="truncate">
                                    {entry.error_type === 'knowledge_gap' && 'Lacuna'}
                                    {entry.error_type === 'interpretation' && 'Interpretação'}
                                    {entry.error_type === 'distraction' && 'Atenção'}
                                    {entry.error_type === 'reasoning' && 'Raciocínio'}
                                </span>
                            </div>
                        ) : (
                            <span className="text-slate-600 text-xs italic">—</span>
                        )}
                        {entry.image_urls && entry.image_urls.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-slate-800 rounded-lg text-slate-400 flex-shrink-0">
                                <ImageIcon className="w-3 h-3" />
                                {entry.image_urls.length}
                            </span>
                        )}
                    </div>

                    {/* Fix #10: Review Date */}
                    <div className="md:col-span-2">
                        {(() => {
                            const nextReview = (entry as any).next_review_date
                            if (!nextReview) {
                                return <span className="text-xs text-slate-600 italic">Nunca revisado</span>
                            }
                            const reviewDate = new Date(nextReview + 'T12:00:00')
                            const overdue = isPast(reviewDate) && !isToday(reviewDate)
                            const dueToday = isToday(reviewDate)
                            return (
                                <div className="flex items-center gap-1.5">
                                    <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${overdue ? 'text-rose-400' : dueToday ? 'text-amber-400' : 'text-slate-500'}`} />
                                    <span className={`text-xs ${overdue ? 'text-rose-400 font-medium' : dueToday ? 'text-amber-400 font-medium' : 'text-slate-500'}`}>
                                        {overdue ? 'Atrasado' : dueToday ? 'Hoje' : format(reviewDate, "dd/MM", { locale: ptBR })}
                                    </span>
                                </div>
                            )
                        })()}
                    </div>

                    {/* Actions — Fix #1: always visible on mobile */}
                    <div className="md:col-span-2 flex items-center justify-end gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
                            className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit() }}
                            className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete() }}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Expanded Content */}
                {expanded && (
                    <div className="border-t border-slate-800 bg-slate-950/50 p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Images */}
                        {entry.image_urls && entry.image_urls.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {entry.image_urls.map((url, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedImage(url)}
                                        className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-700 hover:border-white/50 transition-all group/img"
                                    >
                                        <Image
                                            src={url}
                                            alt={`Imagem ${i + 1}`}
                                            fill
                                            className="object-cover group-hover/img:scale-105 transition-transform"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Answer */}
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <h4 className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                                <Check className="w-4 h-4" /> Resposta
                            </h4>
                            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                                {entry.answer_text}
                            </p>
                        </div>

                        {/* Notes */}
                        {entry.notes && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                <h4 className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    <BrainCircuit className="w-4 h-4" /> Anotações
                                </h4>
                                <p className="text-slate-300 text-sm italic leading-relaxed">
                                    {entry.notes}
                                </p>
                            </div>
                        )}

                        {/* Action Item */}
                        {entry.action_item && (
                            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">Ação Futura</h4>
                                <p className="text-indigo-300 text-sm font-medium">→ {entry.action_item}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative w-full max-w-5xl h-full flex items-center justify-center">
                        <Image
                            src={selectedImage!}
                            alt="Visualização"
                            width={1200}
                            height={800}
                            className="object-contain max-h-[95vh] w-auto h-auto rounded-lg shadow-2xl"
                        />
                        <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

