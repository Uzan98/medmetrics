'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import {
    X,
    Upload,
    Sparkles,
    Check,
    AlertTriangle,
    Loader2,
    Layers,
    Trash2,
    FileText
} from 'lucide-react'
import { toast } from 'sonner'

type Discipline = Database['public']['Tables']['disciplines']['Row']

interface ParsedFlashcard {
    question: string
    answer: string
    selected: boolean
    disciplineName?: string
    subdisciplineName?: string
    topicName?: string
}

interface ImportAIModalProps {
    isOpen: boolean
    onClose: () => void
    disciplines: Discipline[]
    onImportComplete: () => void
}

export function ImportAIModal({ isOpen, onClose, disciplines, onImportComplete }: ImportAIModalProps) {
    const supabase = createClient()
    const [rawText, setRawText] = useState('')
    const [disciplineId, setDisciplineId] = useState('')
    const [importing, setImporting] = useState(false)
    const [step, setStep] = useState<'paste' | 'preview'>('paste')

    const [allSubdisciplines, setAllSubdisciplines] = useState<{ id: number; name: string; discipline_id: number | null }[]>([])
    const [allTopics, setAllTopics] = useState<{ id: number; name: string; subdiscipline_id: number | null }[]>([])

    useEffect(() => {
        async function fetchHierarchy() {
            const { data: subs } = await supabase.from('subdisciplines').select('id, name, discipline_id')
            const { data: tops } = await supabase.from('topics').select('id, name, subdiscipline_id')
            if (subs) setAllSubdisciplines(subs)
            if (tops) setAllTopics(tops)
        }
        fetchHierarchy()
    }, [])

    const parsedCards = useMemo(() => parseFlashcards(rawText), [rawText])

    const [selectedCards, setSelectedCards] = useState<boolean[]>([])

    function goToPreview() {
        if (parsedCards.length === 0) {
            toast.error('Nenhum flashcard encontrado no texto. Verifique o formato.')
            return
        }
        setSelectedCards(parsedCards.map(() => true))
        setStep('preview')
    }

    function toggleCard(index: number) {
        setSelectedCards(prev => prev.map((v, i) => i === index ? !v : v))
    }

    function toggleAll() {
        const allSelected = selectedCards.every(v => v)
        setSelectedCards(selectedCards.map(() => !allSelected))
    }

    async function handleImport() {
        const cardsToImport = parsedCards.filter((_, i) => selectedCards[i])
        if (cardsToImport.length === 0) {
            toast.error('Selecione pelo menos um flashcard para importar.')
            return
        }

        setImporting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('Usuário não autenticado.')
                return
            }

            const payload = cardsToImport.map(card => {
                // Resolve IDs
                let discId = disciplineId ? Number(disciplineId) : null
                let subId: number | null = null
                let topicId: number | null = null

                // 1. Try to find Topic -> Subdiscipline -> Discipline
                if (card.topicName) {
                    const foundTopic = allTopics.find(t => t.name.toLowerCase() === card.topicName?.toLowerCase())
                    if (foundTopic) {
                        topicId = foundTopic.id
                        subId = foundTopic.subdiscipline_id

                        // If we found a subdiscipline, find its discipline
                        if (subId) {
                            const foundSub = allSubdisciplines.find(s => s.id === subId)
                            if (foundSub) {
                                discId = foundSub.discipline_id
                            }
                        }
                    }
                }

                // 2. If no topic match (or no topic provided), try Subdiscipline
                if (!subId && card.subdisciplineName) {
                    const foundSub = allSubdisciplines.find(s => s.name.toLowerCase() === card.subdisciplineName?.toLowerCase())
                    if (foundSub) {
                        subId = foundSub.id
                        discId = foundSub.discipline_id
                    }
                }

                // 3. If no subdiscipline match, try Discipline
                if (!discId && card.disciplineName) {
                    const foundDisc = disciplines.find(d => d.name.toLowerCase() === card.disciplineName?.toLowerCase())
                    if (foundDisc) {
                        discId = foundDisc.id
                    }
                }

                return {
                    user_id: user.id,
                    discipline_id: discId,
                    topic_id: topicId,
                    question_text: card.question,
                    answer_text: card.answer,
                    notes: null,
                    image_urls: [],
                    error_type: null,
                    action_item: null,
                }
            })

            const { error } = await supabase
                .from('error_notebook')
                .insert(payload)

            if (error) throw error

            toast.success(`${cardsToImport.length} flashcards importados com sucesso!`)
            resetAndClose()
            onImportComplete()

        } catch (error) {
            console.error('Error importing:', error)
            toast.error('Erro ao importar flashcards')
        } finally {
            setImporting(false)
        }
    }

    function resetAndClose() {
        setRawText('')
        setDisciplineId('')
        setStep('paste')
        setSelectedCards([])
        onClose()
    }

    const selectedCount = selectedCards.filter(v => v).length

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 100 }}>
            <div className="bg-[#09090b] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl shadow-amber-500/5 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Upload className="w-5 h-5 text-amber-400" />
                        Importar Flashcards da IA
                    </h2>
                    <button onClick={resetAndClose} className="text-zinc-400 hover:text-white transition-colors bg-white/5 p-1 rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {step === 'paste' ? (
                        <div className="p-6 space-y-5">
                            {/* Instructions */}
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-zinc-300 space-y-1">
                                    <p className="font-semibold text-amber-200">Como funciona:</p>
                                    <p>1. Exporte o prompt na aba <span className="text-indigo-400 font-medium">Desempenho</span></p>
                                    <p>2. Cole o prompt no ChatGPT, Gemini ou Claude</p>
                                    <p>3. Cole a resposta aqui. O sistema detectará automaticamente a disciplina e assunto.</p>
                                </div>
                            </div>

                            {/* Discipline selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Disciplina Global (opcional)</label>
                                <select
                                    value={disciplineId}
                                    onChange={(e) => setDisciplineId(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                                >
                                    <option value="">Detecção automática ou sem disciplina</option>
                                    {disciplines.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-zinc-500">Se o flashcard tiver disciplina específica indicada na resposta da IA, ela terá prioridade.</p>
                            </div>

                            {/* Text input */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                                    Resposta da IA
                                </label>
                                <textarea
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    rows={12}
                                    className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none font-mono text-sm leading-relaxed"
                                    placeholder="Cole aqui a resposta da IA com os flashcards..."
                                />
                            </div>

                            {/* Parse preview count */}
                            {rawText.length > 0 && (
                                <div className={`flex items-center gap-2 text-sm font-medium ${parsedCards.length > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                    {parsedCards.length > 0 ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            {parsedCards.length} flashcard{parsedCards.length !== 1 ? 's' : ''} detectado{parsedCards.length !== 1 ? 's' : ''}
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                            Nenhum flashcard detectado. Verifique o formato.
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 space-y-4">
                            {/* Preview header */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-zinc-400">
                                    <span className="text-white font-bold">{selectedCount}</span> de {parsedCards.length} card{parsedCards.length !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
                                </p>
                                <button
                                    onClick={toggleAll}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                                >
                                    {selectedCards.every(v => v) ? 'Desmarcar todos' : 'Selecionar todos'}
                                </button>
                            </div>

                            {/* Card previews */}
                            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                                {parsedCards.map((card, i) => (
                                    <div
                                        key={i}
                                        onClick={() => toggleCard(i)}
                                        className={`relative rounded-xl border p-4 cursor-pointer transition-all ${selectedCards[i]
                                            ? 'bg-indigo-500/5 border-indigo-500/25 shadow-lg shadow-indigo-500/5'
                                            : 'bg-zinc-900/30 border-zinc-800/40 opacity-50'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedCards[i]
                                            ? 'bg-indigo-500 border-indigo-500'
                                            : 'border-zinc-600 bg-transparent'
                                            }`}>
                                            {selectedCards[i] && <Check className="w-3 h-3 text-white" />}
                                        </div>

                                        {/* Card number */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Card {i + 1}</span>
                                            {/* Metadata Badges */}
                                            {card.disciplineName && (
                                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
                                                    {card.disciplineName}
                                                </span>
                                            )}
                                            {card.subdisciplineName && (
                                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
                                                    {card.subdisciplineName}
                                                </span>
                                            )}
                                            {card.topicName && (
                                                <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                                    {card.topicName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Question */}
                                        <p className="text-sm text-zinc-200 font-medium mt-1 pr-8 line-clamp-2">
                                            {card.question}
                                        </p>

                                        {/* Answer preview */}
                                        <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">
                                            {card.answer}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex justify-between items-center bg-zinc-900/30 flex-shrink-0">
                    {step === 'paste' ? (
                        <>
                            <button
                                onClick={resetAndClose}
                                className="px-4 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={goToPreview}
                                disabled={rawText.length === 0 || parsedCards.length === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <FileText className="w-4 h-4" />
                                Preview ({parsedCards.length} cards)
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep('paste')}
                                className="px-4 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors"
                            >
                                ← Voltar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importing || selectedCount === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Importar {selectedCount} card{selectedCount !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * Parses AI-generated flashcard text into structured flashcards.
 * Supports multiple common formats that AIs typically generate.
 */
/**
 * Parses AI-generated flashcard text into structured flashcards using a stateful approach.
 * This ensures that hierarchy metadata (Discipline, Subdiscipline, Topic) persists across multiple cards
 * until a new header is encountered.
 */
function parseFlashcards(text: string): ParsedFlashcard[] {
    if (!text.trim()) return []

    const cards: ParsedFlashcard[] = []
    const lines = text.split('\n').map(l => l.trim()).filter(l => l)

    // State
    let currentDiscipline: string | undefined = undefined
    let currentSubdiscipline: string | undefined = undefined
    let currentTopic: string | undefined = undefined

    // Regex patterns (flexible triggers)
    const disciplineRegex = /^(?:\*\*)?Disciplina(?::)?(?:\*\*)?\s*[:\-]\s*(.+)/i
    const subdisciplineRegex = /^(?:\*\*)?Subdisciplina(?::)?(?:\*\*)?\s*[:\-]\s*(.+)/i
    const topicRegex = /^(?:\*\*)?Assunto(?::)?(?:\*\*)?\s*[:\-]\s*(.+)/i

    // Question/Answer patterns
    const questionRegex = /^(?:\*\*)?(?:Pergunta|Q|Question|Frente|Front)(?::)?(?:\*\*)?\s*[:\-]?\s*(.+)/i
    const answerRegex = /^(?:\*\*)?(?:Resposta|R|Answer|Verso|Back)(?::)?(?:\*\*)?\s*[:\-]?\s*(.+)/i

    // Buffer for current card
    let pendingQuestion: string | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // 1. Check for Hierarchy Metadata
        const discMatch = line.match(disciplineRegex)
        if (discMatch) {
            currentDiscipline = discMatch[1].trim().replace(/\*+$/, '') // remove trailing *
            // Reset lower levels when top level changes? 
            // Usually AI outputs robust blocks, but safety check:
            // currentSubdiscipline = undefined 
            // currentTopic = undefined
            // actually AI often repeats just the changed level, so we keep others if not explicitly changed?
            // No, standard is: if Disc changes, Sub/Topic likely belong to new Disc.
            // But let's keep it sticky for now, or reset? 
            // Safest: When Disc detected, if next lines don't have Sub/Topic, they might be undefined for that Disc?
            // Let's rely on the AI following the prompt: prompt says it outputs all 3.
            // If it outputs just one, we update just that one.
            continue
        }

        const subMatch = line.match(subdisciplineRegex)
        if (subMatch) {
            currentSubdiscipline = subMatch[1].trim().replace(/\*+$/, '')
            continue
        }

        const topicMatch = line.match(topicRegex)
        if (topicMatch) {
            currentTopic = topicMatch[1].trim().replace(/\*+$/, '')
            continue
        }

        // 2. Check for Card Content
        const qMatch = line.match(questionRegex)
        if (qMatch) {
            // If we had a pending question without answer, that's an issue (or multiline). 
            // For simplicity, we assume single-line Q/A or we'd need lookahead.
            // Let's assume the previous pending Q was abandoned or file format is broken.
            pendingQuestion = qMatch[1].trim().replace(/\*+$/, '')
            continue
        }

        const aMatch = line.match(answerRegex)
        if (aMatch && pendingQuestion) {
            const answer = aMatch[1].trim().replace(/\*+$/, '')

            // Create Card with current state
            cards.push({
                question: pendingQuestion,
                answer: answer,
                selected: true,
                disciplineName: currentDiscipline,
                subdisciplineName: currentSubdiscipline,
                topicName: currentTopic
            })

            pendingQuestion = null
            continue
        }

        // 3. Handle Multiline (Optional enhancement)
        // If line didn't match anything and we have pendingQuestion, maybe it's continuation of Q?
        // Or if we just finished A, maybe continuation of A?
        // For now, simple line-based.
    }

    return cards
}
