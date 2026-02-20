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
    Layers,
    BrainCircuit,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Image as ImageIcon,
    Loader2,
    Play,
    Flame,
    Zap,
    Target,
    Trophy,
    Sparkles,
    Clock,
    SlidersHorizontal,
    Upload,
    LayoutList
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { StudyMode } from './StudyMode'
import { ImportAIModal } from './ImportAIModal'
import { DeckList } from './components/DeckList'
import { UpcomingReviews } from './components/UpcomingReviews'
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { id: number; name: string; subdiscipline_id: number | null } | null
    image_urls: string[] | null
    error_type: 'knowledge_gap' | 'interpretation' | 'distraction' | 'reasoning' | null
    action_item: string | null
}

type Discipline = Database['public']['Tables']['disciplines']['Row']
type Subdiscipline = Database['public']['Tables']['subdisciplines']['Row']
type Topic = Database['public']['Tables']['topics']['Row']

interface UserStudyStats {
    user_id: string
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
    const [allSubdisciplines, setAllSubdisciplines] = useState<Subdiscipline[]>([])
    const [topics, setTopics] = useState<Topic[]>([])

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [disciplineFilter, setDisciplineFilter] = useState<number | 'all'>('all')
    const [subdisciplineFilter, setSubdisciplineFilter] = useState<number | 'all'>('all')
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
    const [studySubdiscipline, setStudySubdiscipline] = useState<number | 'all'>('all')
    const [studyTopic, setStudyTopic] = useState<number | 'all'>('all')
    const [viewMode, setViewMode] = useState<'list' | 'deck'>('deck')
    const [userStats, setUserStats] = useState<UserStudyStats | null>(null)

    // Pagination
    const ITEMS_PER_PAGE = 20
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

    // Delete Confirmation Modal
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [showImportAI, setShowImportAI] = useState(false)

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
                .select('*, disciplines(name), topics(id, name, subdiscipline_id)')
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

            // Load Subdisciplines
            const { data: subData } = await supabase
                .from('subdisciplines')
                .select('*')
                .order('name')
            if (subData) setAllSubdisciplines(subData)

            // Load User Study Stats
            const { data: statsData } = await supabase
                .from('user_study_stats')
                .select('*')
                .eq('user_id', user.id)
                .single()
            if (statsData) setUserStats(statsData as UserStudyStats)

        } catch (error) {
            console.error('Error loading data:', error)
            toast.error('Erro ao carregar flashcards')
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
    // Fix: Use local time instead of UTC to avoid "tomorrow is today" bug late at night
    const today = format(new Date(), 'yyyy-MM-dd')
    const pendingEntries = entries.filter(entry => {
        const nextReview = (entry as any).next_review_date
        return !nextReview || nextReview <= today
    })
    const pendingCount = pendingEntries.length

    async function handleDeleteDeck(discId: number | null, subId: number | null, topicId: number | null) {
        if (!confirm('Tem certeza que deseja excluir todos os flashcards deste baralho? Esta ação não pode ser desfeita.')) return

        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let error = null

            if (topicId) {
                // Delete specific topic
                const res = await supabase
                    .from('error_notebook')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('topic_id', topicId)
                error = res.error
            } else if (subId) {
                // Delete subdiscipline (all topics within it)
                // First get all topics for this subdiscipline
                const { data: subTopics } = await supabase
                    .from('topics')
                    .select('id')
                    .eq('subdiscipline_id', subId)

                if (subTopics && subTopics.length > 0) {
                    const topicIds = subTopics.map(t => t.id)
                    const res = await supabase
                        .from('error_notebook')
                        .delete()
                        .eq('user_id', user.id)
                        .in('topic_id', topicIds)
                    error = res.error
                }
            } else if (discId) {
                // Delete entire discipline
                const res = await supabase
                    .from('error_notebook')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('discipline_id', discId)
                error = res.error
            }

            if (error) throw error

            toast.success('Baralho excluído com sucesso!')
            await loadData()
        } catch (error) {
            console.error('Error deleting deck:', error)
            toast.error('Erro ao excluir baralho')
        } finally {
            setLoading(false)
        }
    }

    const filteredEntries = entries.filter(entry => {
        const matchesSearch = entry.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.disciplines?.name || '').toLowerCase().includes(searchTerm.toLowerCase())

        const matchesDiscipline = disciplineFilter === 'all' || entry.discipline_id === disciplineFilter
        const matchesSubdiscipline = subdisciplineFilter === 'all' || entry.topics?.subdiscipline_id === subdisciplineFilter

        const matchesErrorType = errorTypeFilter === 'all' || entry.error_type === errorTypeFilter

        const matchesPending = !showOnlyPending || pendingEntries.some(p => p.id === entry.id)

        return matchesSearch && matchesDiscipline && matchesSubdiscipline && matchesErrorType && matchesPending
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
                    subdisciplineId={studySubdiscipline}
                    topicId={studyTopic}
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

            <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in pb-24">
                {/* ── Hero Header ── */}
                <div className="relative rounded-2xl overflow-hidden">
                    {/* Mesh gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-zinc-900 to-purple-950" />
                    <div className="absolute inset-0 opacity-30" style={{
                        backgroundImage: 'radial-gradient(at 20% 30%, rgba(99,102,241,0.4) 0, transparent 50%), radial-gradient(at 80% 20%, rgba(168,85,247,0.3) 0, transparent 50%), radial-gradient(at 50% 80%, rgba(236,72,153,0.2) 0, transparent 50%)'
                    }} />

                    <div className="relative z-10 p-5 sm:p-7">
                        {/* Top — Title + Buttons */}
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                        <Layers className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-black text-white tracking-tight">Flashcards</h1>
                                        <p className="text-indigo-300/60 text-sm font-medium">Estude com repetição espaçada</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2.5">
                                {/* Primary Action: Review or All Done */}
                                {pendingCount > 0 ? (
                                    <button
                                        onClick={() => {
                                            setStudyDiscipline('all')
                                            setStudySubdiscipline('all')
                                            setStudyTopic('all')
                                            setShowOnlyPending(true)
                                            setShowStudyMode(true)
                                        }}
                                        className="group px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                                        title="Revisar cards agendados para hoje"
                                    >
                                        <Play className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        Revisar ({pendingCount})
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="px-5 py-2.5 bg-zinc-800/50 text-zinc-500 rounded-xl font-bold text-sm border border-zinc-700/50 flex items-center gap-2 cursor-not-allowed"
                                        title="Nenhum card para revisar hoje"
                                    >
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        Tudo em dia!
                                    </button>
                                )}

                                {/* Secondary Action: Free Study / Practice */}
                                <button
                                    onClick={() => setShowStudySetup(true)}
                                    disabled={entries.length === 0}
                                    className="px-5 py-2.5 bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-300 hover:text-white rounded-xl font-bold text-sm transition-all border border-zinc-700/40 hover:border-zinc-600/50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Modo de estudo livre (todos os cards)"
                                >
                                    <Layers className="w-4 h-4" />
                                    Estudar Livre
                                </button>

                                <Link
                                    href="/caderno-de-erros/estatisticas"
                                    className="px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded-xl font-bold text-sm transition-all border border-purple-500/30 hover:border-purple-400/50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                    title="Estatísticas"
                                >
                                    <Trophy className="w-4 h-4" />
                                    Análise
                                </Link>

                                <button
                                    onClick={() => setShowImportAI(true)}
                                    disabled={disciplines.length === 0}
                                    className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 rounded-xl font-bold text-sm transition-all border border-amber-500/25 hover:border-amber-500/40 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                >
                                    <Upload className="w-4 h-4" />
                                    Importar da IA
                                </button>

                                <Link
                                    href="/caderno-de-erros/gerenciar"
                                    className="px-4 py-2.5 bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-300 hover:text-white rounded-xl font-bold text-sm transition-all border border-zinc-700/40 hover:border-zinc-600/50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <LayoutList className="w-4 h-4" />
                                    Gerenciar
                                </Link>

                                <button
                                    onClick={() => {
                                        setEditingEntry(null)
                                        resetForm()
                                        setIsModalOpen(true)
                                    }}
                                    className="px-5 py-2.5 bg-white/8 hover:bg-white/15 text-white/90 rounded-xl font-semibold text-sm transition-all border border-white/10 hover:border-white/25 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Plus className="w-4 h-4" />
                                    Novo Card
                                </button>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/[0.06] backdrop-blur-sm rounded-xl p-3.5 border border-white/[0.08] hover:bg-white/[0.09] transition-colors group">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                        <Flame className="w-4 h-4 text-orange-400" />
                                    </div>
                                    <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">Sequência</span>
                                </div>
                                <p className="text-2xl font-black text-white">{userStats?.current_streak || 0}<span className="text-sm font-medium text-zinc-500 ml-1">dias</span></p>
                            </div>

                            <div className="bg-white/[0.06] backdrop-blur-sm rounded-xl p-3.5 border border-white/[0.08] hover:bg-white/[0.09] transition-colors group">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                        <Zap className="w-4 h-4 text-yellow-400" />
                                    </div>
                                    <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">XP Total</span>
                                </div>
                                <p className="text-2xl font-black text-white">{userStats?.total_xp || 0}</p>
                            </div>

                            <div className="bg-white/[0.06] backdrop-blur-sm rounded-xl p-3.5 border border-white/[0.08] hover:bg-white/[0.09] transition-colors group">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                        <Target className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">Revisados</span>
                                </div>
                                <p className="text-2xl font-black text-white">{userStats?.total_cards_reviewed || 0}</p>
                            </div>

                            <div className="bg-white/[0.06] backdrop-blur-sm rounded-xl p-3.5 border border-white/[0.08] hover:bg-white/[0.09] transition-colors group">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                        <Layers className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">Total Cards</span>
                                </div>
                                <p className="text-2xl font-black text-white">{entries.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <UpcomingReviews entries={entries} />

                {/* Study Setup Modal */}
                {showStudySetup && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" style={{ zIndex: 100 }}>
                        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
                            <div className="text-center mb-8">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                                    <Play className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2">Iniciar Sessão de Estudo</h2>
                                <p className="text-zinc-400">Escolha uma disciplina ou estude todos os cards</p>
                            </div>

                            <div className="space-y-3 mb-8">
                                <button
                                    onClick={() => {
                                        setStudyDiscipline('all')
                                        setStudySubdiscipline('all')
                                        setStudyTopic('all')
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
                                                setStudySubdiscipline('all')
                                                setStudyTopic('all')
                                                setShowStudySetup(false)
                                                setShowStudyMode(true)
                                            }}
                                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white font-medium transition-all flex items-center justify-between px-4"
                                        >
                                            <span>{disc.name}</span>
                                            <span className="text-zinc-500">{count} cards</span>
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={() => setShowStudySetup(false)}
                                className="w-full py-3 text-zinc-400 hover:text-white transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Search & Filters ── */}
                <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 sticky top-4 z-20 shadow-xl shadow-black/10">
                    <div className="flex gap-2.5 p-3.5">
                        <div className="flex bg-zinc-800/60 rounded-xl p-1 border border-zinc-700/40 hidden md:flex flex-shrink-0">
                            <button
                                onClick={() => setViewMode('deck')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'deck' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title="Visualizar por Baralhos"
                            >
                                <Layers className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title="Visualizar em Lista"
                            >
                                <LayoutList className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 relative group">
                            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar por pergunta, tema ou disciplina..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:bg-zinc-800 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`md:hidden px-3.5 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${showFilters || disciplineFilter !== 'all' || errorTypeFilter !== 'all' || showOnlyPending
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400'
                                }`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            {(disciplineFilter !== 'all' || errorTypeFilter !== 'all' || showOnlyPending) && (
                                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            )}
                        </button>
                    </div>
                    <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-2.5 px-3.5 pb-3.5 border-t border-zinc-800/50 md:border-t-0 pt-3 md:pt-0`}>
                        <div className="w-full md:w-48">
                            <select
                                value={disciplineFilter}
                                onChange={(e) => {
                                    setDisciplineFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                                    setSubdisciplineFilter('all')
                                }}
                                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                            >
                                <option value="all">Todas Disciplinas</option>
                                {disciplines.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Subdiscipline Filter */}
                        {disciplineFilter !== 'all' && (
                            <div className="w-full md:w-48 animate-in fade-in slide-in-from-left-2 duration-200">
                                <select
                                    value={subdisciplineFilter}
                                    onChange={(e) => setSubdisciplineFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="all">Todas Subdisciplinas</option>
                                    {allSubdisciplines
                                        .filter(s => s.discipline_id === disciplineFilter)
                                        .map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                </select>
                            </div>
                        )}

                        <div className="w-full md:w-48">
                            <select
                                value={errorTypeFilter}
                                onChange={(e) => setErrorTypeFilter(e.target.value as any)}
                                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
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
                            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${showOnlyPending
                                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/10'
                                : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                        >
                            <Clock className="w-4 h-4" />
                            Pendentes
                            {showOnlyPending && <span className="font-bold">({pendingCount})</span>}
                        </button>
                    </div>
                </div>

                {/* ── Content ── */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-zinc-900/40 rounded-xl border border-zinc-800/40 p-4">
                                <div className="flex gap-3">
                                    <div className="w-1 rounded-full bg-zinc-800" />
                                    <div className="flex-1 space-y-3">
                                        <div className="flex gap-2">
                                            <div className="h-3 w-24 bg-zinc-800 rounded-full" />
                                            <div className="h-3 w-16 bg-zinc-800/60 rounded-full" />
                                        </div>
                                        <div className="h-4 w-3/4 bg-zinc-800/80 rounded-full" />
                                        <div className="h-3 w-1/3 bg-zinc-800/40 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="relative text-center py-20 rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-5 border border-indigo-500/10">
                                <Layers className="w-9 h-9 text-indigo-400/70" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                {searchTerm || disciplineFilter !== 'all' || errorTypeFilter !== 'all'
                                    ? 'Nenhum resultado encontrado'
                                    : 'Nenhum erro registrado'
                                }
                            </h3>
                            <p className="text-zinc-500 max-w-sm mx-auto mb-6 text-sm leading-relaxed">
                                {searchTerm || disciplineFilter !== 'all' || errorTypeFilter !== 'all'
                                    ? 'Tente usar outros filtros ou termos de busca.'
                                    : 'Comece a registrar seus erros para criar um banco de conhecimento personalizado.'
                                }
                            </p>
                            {!searchTerm && disciplineFilter === 'all' && errorTypeFilter === 'all' && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="px-5 py-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 rounded-xl font-semibold text-sm transition-all border border-indigo-500/20 hover:border-indigo-500/40 inline-flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar primeiro flashcard
                                </button>
                            )}
                        </div>
                    </div>
                ) : viewMode === 'deck' ? (
                    <DeckList
                        entries={filteredEntries}
                        disciplines={disciplines}
                        subdisciplines={allSubdisciplines}
                        onStudy={(d, s, t) => {
                            setStudyDiscipline(d)
                            setStudySubdiscipline(s)
                            setStudyTopic(t)
                            setShowStudyMode(true)
                        }}
                        onDelete={handleDeleteDeck}
                    />
                ) : (
                    <div className="space-y-2.5">
                        {/* Result counter */}
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-zinc-500 font-medium">
                                {filteredEntries.length === entries.length
                                    ? <span><span className="text-zinc-300 font-bold">{entries.length}</span> cards</span>
                                    : <span><span className="text-zinc-300 font-bold">{filteredEntries.length}</span> de {entries.length} cards</span>
                                }
                            </p>
                            {(disciplineFilter !== 'all' || errorTypeFilter !== 'all' || showOnlyPending || searchTerm) && (
                                <button
                                    onClick={() => { setSearchTerm(''); setDisciplineFilter('all'); setErrorTypeFilter('all'); setShowOnlyPending(false) }}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>

                        {/* Cards */}
                        <div className="space-y-2">
                            {paginatedEntries.map(entry => (
                                <ErrorRow key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => setDeleteTarget(entry.id)} />
                            ))}
                        </div>

                        {/* Load more */}
                        {hasMore && (
                            <div className="flex justify-center pt-3">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                                    className="px-6 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600 rounded-xl text-sm text-zinc-300 hover:text-white font-semibold transition-all flex items-center gap-2"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                    Carregar mais ({filteredEntries.length - visibleCount} restantes)
                                </button>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <ImportAIModal
                isOpen={showImportAI}
                onClose={() => setShowImportAI(false)}
                disciplines={disciplines}
                onImportComplete={() => {
                    setShowImportAI(false)
                    loadData()
                }}
            />

            {/* Fix #8: Custom Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 110 }}>
                    <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7 text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Excluir Flashcard</h3>
                        <p className="text-zinc-400 text-sm text-center mb-6">Tem certeza que deseja excluir este card? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 font-medium transition-all"
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
                        <div className="bg-[#09090b] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-indigo-500/10">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {editingEntry ? <Edit className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                                    {editingEntry ? 'Editar Flashcard' : 'Novo Flashcard'}
                                </h2>
                                <button onClick={closeModal} className="text-zinc-400 hover:text-white transition-colors bg-white/5 p-1 rounded-lg hover:bg-white/10">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Disciplina</label>
                                        <select
                                            required
                                            value={formData.discipline_id}
                                            onChange={(e) => setFormData({ ...formData, discipline_id: e.target.value, topic_id: '' })}
                                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-zinc-500"
                                        >
                                            <option value="">Selecione...</option>
                                            {disciplines.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Assunto</label>
                                        <select
                                            value={formData.topic_id}
                                            onChange={(e) => setFormData({ ...formData, topic_id: e.target.value })}
                                            disabled={!formData.discipline_id}
                                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
                                        >
                                            <option value="">Selecione...</option>
                                            {topics.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pergunta / Conceito</label>
                                    <div className="relative">
                                        <textarea
                                            required
                                            rows={3}
                                            value={formData.question_text}
                                            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                                            placeholder="Ex: Qual o tratamento de primeira linha para..."
                                        />

                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Resposta / Explicação</label>
                                    <div className="relative">
                                        <textarea
                                            required
                                            rows={4}
                                            value={formData.answer_text}
                                            onChange={(e) => setFormData({ ...formData, answer_text: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 resize-none"
                                            placeholder="A resposta correta é..."
                                        />
                                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Notas Adicionais</label>
                                    <textarea
                                        rows={2}
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none"
                                        placeholder="Dica: Lembrar da regra..."
                                    />
                                </div>

                                <details className="group/details">
                                    <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors py-1 select-none">
                                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-open/details:rotate-90" />
                                        Campos avançados (opcional)
                                    </summary>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tipo de Erro (Metacognição)</label>
                                            <select
                                                value={formData.error_type || ''}
                                                onChange={(e) => setFormData({ ...formData, error_type: e.target.value as any })}
                                                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
                                            >
                                                <option value="">Selecione o motivo...</option>
                                                <option value="knowledge_gap">Lacuna de Conteúdo (Não sabia)</option>
                                                <option value="interpretation">Falha de Interpretação (Não entendi)</option>
                                                <option value="distraction">Falta de Atenção (Distração/Li errado)</option>
                                                <option value="reasoning">Erro de Raciocínio (Conexão errada)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ação Corretiva</label>
                                            <input
                                                type="text"
                                                value={formData.action_item}
                                                onChange={(e) => setFormData({ ...formData, action_item: e.target.value })}
                                                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                placeholder="O que você fará diferente?"
                                            />
                                        </div>
                                    </div>
                                </details>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Imagens</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                        {/* Existing Images */}
                                        {formData.image_urls.map((url, index) => (
                                            <div key={`existing-${index}`} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-700/50 group">
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
                                            <div key={`new-${index}`} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-700/50 group">
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

                                        <label className="aspect-square rounded-xl border-2 border-dashed border-zinc-700/50 hover:border-indigo-500 hover:bg-zinc-800/50 cursor-pointer flex flex-col items-center justify-center transition-all group">
                                            <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-indigo-500/20 transition-colors mb-2">
                                                <ImageIcon className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400" />
                                            </div>
                                            <span className="text-xs text-zinc-500 group-hover:text-indigo-400 font-medium">Adicionar</span>
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
                                        className="px-4 py-2.5 text-zinc-300 hover:text-white font-medium transition-colors"
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
        bg: 'bg-zinc-900',
        iconBg: 'bg-indigo-500/20',
        icon: 'text-indigo-400',
        badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        glow: 'hover:shadow-indigo-500/20'
    }

    const n = name.toLowerCase()

    if (n.includes('clínica') || n.includes('clinica')) return {
        accent: 'bg-gradient-to-b from-amber-400 to-orange-500',
        bg: 'bg-zinc-900',
        iconBg: 'bg-amber-500/20',
        icon: 'text-amber-400',
        badge: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
        glow: 'hover:shadow-amber-500/20'
    }

    if (n.includes('cirurgia')) return {
        accent: 'bg-gradient-to-b from-emerald-400 to-teal-500',
        bg: 'bg-zinc-900',
        iconBg: 'bg-emerald-500/20',
        icon: 'text-emerald-400',
        badge: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50',
        glow: 'hover:shadow-emerald-500/20'
    }

    if (n.includes('pediatria')) return {
        accent: 'bg-gradient-to-b from-cyan-400 to-blue-500',
        bg: 'bg-zinc-900',
        iconBg: 'bg-cyan-500/20',
        icon: 'text-cyan-400',
        badge: 'bg-cyan-950/50 text-cyan-300 border-cyan-800/50',
        glow: 'hover:shadow-cyan-500/20'
    }

    if (n.includes('ginecologia') || n.includes('obstetrícia')) return {
        accent: 'bg-gradient-to-b from-pink-400 to-rose-500',
        bg: 'bg-zinc-900',
        iconBg: 'bg-pink-500/20',
        icon: 'text-pink-400',
        badge: 'bg-pink-950/50 text-pink-300 border-pink-800/50',
        glow: 'hover:shadow-pink-500/20'
    }

    if (n.includes('preventiva') || n.includes('coletiva')) return {
        accent: 'bg-gradient-to-b from-violet-400 to-purple-500',
        bg: 'bg-zinc-900',
        iconBg: 'bg-violet-500/20',
        icon: 'text-violet-400',
        badge: 'bg-violet-950/50 text-violet-300 border-violet-800/50',
        glow: 'hover:shadow-violet-500/20'
    }

    return {
        accent: 'bg-gradient-to-b from-indigo-400 to-blue-500',
        bg: 'bg-zinc-900',
        iconBg: 'bg-indigo-500/20',
        icon: 'text-indigo-400',
        badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        glow: 'hover:shadow-indigo-500/20'
    }
}

function ErrorRow({ entry, onEdit, onDelete }: { entry: ErrorEntry, onEdit: () => void, onDelete: () => void }) {
    const [expanded, setExpanded] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    const styles = getDisciplineStyles(entry.disciplines?.name);

    const nextReview = (entry as any).next_review_date
    const reviewDate = nextReview ? new Date(nextReview + 'T12:00:00') : null
    const overdue = reviewDate ? isPast(reviewDate) && !isToday(reviewDate) : false
    const dueToday = reviewDate ? isToday(reviewDate) : false

    const errorTypeConfig = {
        knowledge_gap: { label: 'Lacuna', color: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-400' },
        interpretation: { label: 'Interpretação', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20', dot: 'bg-orange-400' },
        distraction: { label: 'Atenção', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', dot: 'bg-yellow-400' },
        reasoning: { label: 'Raciocínio', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' },
    }

    const errorType = entry.error_type ? errorTypeConfig[entry.error_type] : null

    return (
        <>
            <div
                className={`
                    group relative rounded-xl overflow-hidden transition-all duration-200 cursor-pointer
                    ${expanded
                        ? `bg-zinc-900 border border-zinc-700/80 shadow-xl shadow-black/20 ${styles.glow}`
                        : `bg-zinc-900/50 border border-zinc-800/60 hover:bg-zinc-900/80 hover:border-zinc-700/60 ${styles.glow}`
                    }
                `}
                onClick={() => setExpanded(!expanded)}
            >
                {/* Gradient left accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accent}`} />

                <div className="flex items-start gap-3.5 p-4 pl-5">
                    {/* Discipline icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center mt-0.5`}>
                        <Layers className={`w-5 h-5 ${styles.icon}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Header line */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-bold ${styles.icon} uppercase tracking-wide`}>
                                {entry.disciplines?.name || 'Sem disciplina'}
                            </span>
                            {entry.topics && (
                                <>
                                    <span className="text-zinc-700">›</span>
                                    <span className="text-xs text-zinc-400 font-medium">
                                        {entry.topics.name}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Question */}
                        <p className="text-[15px] text-zinc-200 leading-relaxed line-clamp-2 font-medium group-hover:text-white transition-colors">
                            {entry.question_text}
                        </p>

                        {/* Meta bar */}
                        <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                            {/* Error type badge */}
                            {errorType && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${errorType.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${errorType.dot}`} />
                                    {errorType.label}
                                </span>
                            )}

                            {/* Review date */}
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${overdue ? 'text-rose-400' : dueToday ? 'text-amber-400' : 'text-zinc-500'
                                }`}>
                                <Clock className="w-3 h-3" />
                                {!reviewDate ? 'Sem revisão' : overdue ? 'Atrasado' : dueToday ? 'Revisar hoje' : format(reviewDate, "dd/MM", { locale: ptBR })}
                            </span>

                            {/* Image count */}
                            {entry.image_urls && entry.image_urls.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
                                    <ImageIcon className="w-3 h-3" />
                                    {entry.image_urls.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit() }}
                            className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Editar"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete() }}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Excluir"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Expand indicator */}
                    <div className="flex-shrink-0 p-1 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {/* ── Expanded Content ── */}
                {expanded && (
                    <div className="border-t border-zinc-800/60 px-5 py-5 space-y-4 animate-in slide-in-from-top-2 duration-200 bg-gradient-to-b from-zinc-900/50 to-transparent">
                        {/* Images */}
                        {entry.image_urls && entry.image_urls.length > 0 && (
                            <div className="flex gap-2.5 overflow-x-auto pb-1">
                                {entry.image_urls.map((url, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => { e.stopPropagation(); setSelectedImage(url) }}
                                        className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-zinc-700/50 hover:border-indigo-500/50 transition-all group/img shadow-lg shadow-black/20"
                                    >
                                        <Image
                                            src={url}
                                            alt={`Imagem ${i + 1}`}
                                            fill
                                            className="object-cover group-hover/img:scale-110 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                            <Eye className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Answer */}
                        <div className="rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                            <h4 className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                                <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                </div>
                                Resposta Correta
                            </h4>
                            <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-line">
                                {entry.answer_text}
                            </p>
                        </div>

                        {/* Notes */}
                        {entry.notes && (
                            <div className="rounded-xl p-4 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                                <h4 className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center">
                                        <BrainCircuit className="w-3 h-3" />
                                    </div>
                                    Anotações
                                </h4>
                                <p className="text-zinc-300 text-sm leading-relaxed">
                                    {entry.notes}
                                </p>
                            </div>
                        )}

                        {/* Action Item */}
                        {entry.action_item && (
                            <div className="rounded-xl p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border border-indigo-500/20">
                                <h4 className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    <div className="w-5 h-5 rounded-md bg-indigo-500/20 flex items-center justify-center">
                                        <Target className="w-3 h-3" />
                                    </div>
                                    Ação Futura
                                </h4>
                                <p className="text-indigo-200/80 text-sm font-medium">→ {entry.action_item}</p>
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
