'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Discipline, Subdiscipline, Topic } from '@/types/database'

interface MoveCardsModalProps {
    count: number
    onClose: () => void
    onMove: (disciplineId: number, subdisciplineId: number | null, topicId: number | null) => Promise<void>
}

export function MoveCardsModal({ count, onClose, onMove }: MoveCardsModalProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    // Data
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [subdisciplines, setSubdisciplines] = useState<Subdiscipline[]>([])
    const [topics, setTopics] = useState<Topic[]>([])

    // Selection
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('')
    const [selectedSubdiscipline, setSelectedSubdiscipline] = useState<string>('')
    const [selectedTopic, setSelectedTopic] = useState<string>('')

    useEffect(() => {
        async function loadData() {
            setFetching(true)
            const [d, s, t] = await Promise.all([
                supabase.from('disciplines').select('*').order('name'),
                supabase.from('subdisciplines').select('*').order('name'),
                supabase.from('topics').select('*').order('name')
            ])

            if (d.data) setDisciplines(d.data)
            if (s.data) setSubdisciplines(s.data)
            if (t.data) setTopics(t.data)
            setFetching(false)
        }
        loadData()
    }, [])

    const filteredSubdisciplines = subdisciplines.filter(s => s.discipline_id === Number(selectedDiscipline))
    const filteredTopics = topics.filter(t => t.subdiscipline_id === Number(selectedSubdiscipline))

    async function handleConfirm() {
        if (!selectedDiscipline) return
        setLoading(true)
        try {
            await onMove(
                Number(selectedDiscipline),
                selectedSubdiscipline ? Number(selectedSubdiscipline) : null,
                selectedTopic ? Number(selectedTopic) : null
            )
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-indigo-400" />
                        Mover {count} {count === 1 ? 'card' : 'cards'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {fetching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                        </div>
                    ) : (
                        <>
                            {/* Discipline */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase">Disciplina</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all"
                                    value={selectedDiscipline}
                                    onChange={e => {
                                        setSelectedDiscipline(e.target.value)
                                        setSelectedSubdiscipline('')
                                        setSelectedTopic('')
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {disciplines.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Subdiscipline */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase">Subdisciplina</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all disabled:opacity-50"
                                    value={selectedSubdiscipline}
                                    onChange={e => {
                                        setSelectedSubdiscipline(e.target.value)
                                        setSelectedTopic('')
                                    }}
                                    disabled={!selectedDiscipline}
                                >
                                    <option value="">Selecione...</option>
                                    {filteredSubdisciplines.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Topic */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase">Assunto</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all disabled:opacity-50"
                                    value={selectedTopic}
                                    onChange={e => setSelectedTopic(e.target.value)}
                                    disabled={!selectedSubdiscipline}
                                >
                                    <option value="">Selecione...</option>
                                    {filteredTopics.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-white font-medium transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !selectedDiscipline}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Mover Cards
                    </button>
                </div>
            </div>
        </div>
    )
}
