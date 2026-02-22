'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Search,
    Trash2,
    ArrowRight,
    RotateCcw,
    CheckSquare,
    Square,
    Loader2,
    Filter,
    ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { MoveCardsModal } from '../components/MoveCardsModal'

// Types
interface CardRow {
    id: string
    question_text: string
    discipline_id: number | null
    topic_id: number | null
    next_review_date: string | null
    state: number // FSRS state
    disciplines?: { name: string }
    topics?: { name: string, subdisciplines?: { name: string } }
}

export default function ManageCardsPage() {
    const supabase = createClient()
    const router = useRouter()

    // Data
    const [cards, setCards] = useState<CardRow[]>([])
    const [loading, setLoading] = useState(true)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Filters
    const [search, setSearch] = useState('')
    const [filterDiscipline, setFilterDiscipline] = useState<string>('')

    // Modals
    const [showMoveModal, setShowMoveModal] = useState(false)
    const [processing, setProcessing] = useState(false)

    // Derived Data
    const disciplines = Array.from(new Set(cards.map(c => c.disciplines?.name).filter(Boolean)))

    const filteredCards = cards.filter(card => {
        const matchSearch = card.question_text.toLowerCase().includes(search.toLowerCase())
        const matchDiscipline = !filterDiscipline || card.disciplines?.name === filterDiscipline
        return matchSearch && matchDiscipline
    })

    const allSelected = filteredCards.length > 0 && filteredCards.every(c => selectedIds.has(c.id))
    const someSelected = filteredCards.some(c => selectedIds.has(c.id)) && !allSelected

    // Load Data
    useEffect(() => {
        loadCards()
    }, [])

    async function loadCards() {
        setLoading(true)
        try {
            let allCards: any[] = []
            let page = 0
            const pageSize = 1000

            while (true) {
                const { data, error } = await supabase
                    .from('error_notebook')
                    .select(`
                        id,
                        question_text,
                        discipline_id,
                        topic_id,
                        next_review_date,
                        state,
                        disciplines (name),
                        topics (
                            name,
                            subdisciplines (name)
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1)

                if (error) throw error
                if (data && data.length > 0) {
                    allCards.push(...data)
                    if (data.length < pageSize) break
                    page++
                } else {
                    break
                }
            }
            setCards(allCards as any) // Type assertion due to join complexity
        } catch (error) {
            console.error('Error loading cards:', error)
            toast.error('Erro ao carregar cards')
        } finally {
            setLoading(false)
        }
    }

    // Handlers
    function toggleSelectAll() {
        if (allSelected) {
            const newSet = new Set(selectedIds)
            filteredCards.forEach(c => newSet.delete(c.id))
            setSelectedIds(newSet)
        } else {
            const newSet = new Set(selectedIds)
            filteredCards.forEach(c => newSet.add(c.id))
            setSelectedIds(newSet)
        }
    }

    function toggleSelect(id: string) {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    async function handleDeleteSelected() {
        if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} cards?`)) return

        setProcessing(true)
        try {
            const { error } = await supabase
                .from('error_notebook')
                .delete()
                .in('id', Array.from(selectedIds))

            if (error) throw error

            toast.success(`${selectedIds.size} cards excluídos`)
            setCards(prev => prev.filter(c => !selectedIds.has(c.id)))
            setSelectedIds(new Set())
        } catch (error) {
            console.error(error)
            toast.error('Erro ao excluir cards')
        } finally {
            setProcessing(prev => false) // Keep false or ensure boolean
            setProcessing(false)
        }
    }

    async function handleResetProgress() {
        if (!confirm(`Resetar o progresso de ${selectedIds.size} cards? Eles voltarão ao status "Novo".`)) return

        setProcessing(true)
        try {
            const { error } = await supabase
                .from('error_notebook')
                .update({
                    state: 0, // New
                    interval: 0,
                    stability: 0,
                    difficulty: 0,
                    lapses: 0,
                    review_count: 0,
                    next_review_date: null,
                    last_reviewed_at: null
                } as any)
                .in('id', Array.from(selectedIds))

            if (error) throw error

            // Delete reviews history too? Maybe keep for accountability, but usually reset means start over.
            // Let's keep reviews but reset card state.

            toast.success('Progresso resetado com sucesso')
            // Optimistic update
            setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, state: 0, next_review_date: null } : c))
            setSelectedIds(new Set())
        } catch (error) {
            console.error(error)
            toast.error('Erro ao resetar progresso')
        } finally {
            setProcessing(false)
        }
    }

    async function handleMoveCards(disciplineId: number, subdisciplineId: number | null, topicId: number | null) {
        setProcessing(true)
        try {
            const { error } = await supabase
                .from('error_notebook')
                .update({
                    discipline_id: disciplineId,
                    topic_id: topicId
                })
                .in('id', Array.from(selectedIds))

            if (error) throw error

            toast.success(`${selectedIds.size} cards movidos`)
            loadCards() // Reload to get new names
            setSelectedIds(new Set())
        } catch (error) {
            console.error(error)
            toast.error('Erro ao mover cards')
            throw error
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="min-h-screen bg-black text-zinc-100 p-6 space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/caderno-de-erros" className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Gerenciar Cards</h1>
                    <p className="text-zinc-500 text-sm">Organize, mova ou exclua seus flashcards em massa.</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar cards..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-zinc-500" />
                    <select
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                        value={filterDiscipline}
                        onChange={e => setFilterDiscipline(e.target.value)}
                    >
                        <option value="">Todas as Disciplinas</option>
                        {disciplines.map(d => (
                            <option key={d as string} value={d as string}>{d as string}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 flex justify-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : filteredCards.length === 0 ? (
                    <div className="p-12 text-center text-zinc-500">
                        Nenhum card encontrado para os filtros.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                                <tr>
                                    <th className="p-4 w-10">
                                        <button onClick={toggleSelectAll} className="flex items-center">
                                            {allSelected ? (
                                                <CheckSquare className="w-5 h-5 text-indigo-500" />
                                            ) : someSelected ? (
                                                <div className="w-5 h-5 bg-indigo-500/20 text-indigo-500 rounded flex items-center justify-center">
                                                    <div className="w-3 h-0.5 bg-current rounded-full" />
                                                </div>
                                            ) : (
                                                <Square className="w-5 h-5 text-zinc-600 hover:text-zinc-500" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="p-4 font-medium">Pergunta</th>
                                    <th className="p-4 font-medium">Disciplina / Tópico</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium">Revisão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {filteredCards.map(card => {
                                    const isSelected = selectedIds.has(card.id)
                                    const subName = card.topics?.subdisciplines?.name
                                    const topicName = card.topics?.name
                                    const fullContext = [card.disciplines?.name, subName, topicName].filter(Boolean).join(' > ')

                                    const stateLabel = ['Novo', 'Aprendendo', 'Revisando', 'Reaprendendo'][card.state] || 'Novo'
                                    const stateColor = ['text-blue-400', 'text-amber-400', 'text-emerald-400', 'text-red-400'][card.state] || 'text-zinc-400'

                                    return (
                                        <tr
                                            key={card.id}
                                            className={`group hover:bg-zinc-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-500/5' : ''}`}
                                            onClick={() => toggleSelect(card.id)}
                                        >
                                            <td className="p-4">
                                                {isSelected ? (
                                                    <CheckSquare className="w-5 h-5 text-indigo-500" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-zinc-700 group-hover:text-zinc-500" />
                                                )}
                                            </td>
                                            <td className="p-4 max-w-md">
                                                <div
                                                    className="truncate font-medium text-zinc-200"
                                                    dangerouslySetInnerHTML={{ __html: card.question_text }}
                                                />
                                            </td>
                                            <td className="p-4 text-zinc-400">
                                                {fullContext}
                                            </td>
                                            <td className={`p-4 font-medium ${stateColor}`}>
                                                {stateLabel}
                                            </td>
                                            <td className="p-4 text-zinc-400">
                                                {card.next_review_date ? new Date(card.next_review_date).toLocaleDateString('pt-BR') : '-'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mass Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-5 duration-300 z-50">
                    <span className="text-sm font-semibold text-white px-2 border-r border-zinc-700">
                        {selectedIds.size} selecionados
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowMoveModal(true)}
                            disabled={processing}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white flex flex-col items-center gap-1 transition-colors disabled:opacity-50"
                            title="Mover"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleResetProgress}
                            disabled={processing}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-amber-400 flex flex-col items-center gap-1 transition-colors disabled:opacity-50"
                            title="Resetar Progresso"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleDeleteSelected}
                            disabled={processing}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-red-400 flex flex-col items-center gap-1 transition-colors disabled:opacity-50"
                            title="Excluir"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showMoveModal && (
                <MoveCardsModal
                    count={selectedIds.size}
                    onClose={() => setShowMoveModal(false)}
                    onMove={handleMoveCards}
                />
            )}
        </div>
    )
}
