'use client'

import { useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Database } from '@/types/database'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { id: number; name: string; subdiscipline_id: number | null } | null
    image_urls: string[] | null
    error_type: 'knowledge_gap' | 'interpretation' | 'distraction' | 'reasoning' | null
    action_item: string | null
    // FSRS fields
    stability?: number
    difficulty?: number
    state?: number
    lapses?: number
}

interface QuickEditModalProps {
    entry: ErrorEntry
    onClose: () => void
    onSave: (updatedEntry: ErrorEntry) => void
}

export function QuickEditModal({ entry, onClose, onSave }: QuickEditModalProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        question_text: entry.question_text,
        answer_text: entry.answer_text,
        notes: entry.notes || ''
    })

    async function handleSave() {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('error_notebook')
                .update({
                    question_text: formData.question_text,
                    answer_text: formData.answer_text,
                    notes: formData.notes
                })
                .eq('id', entry.id)

            if (error) throw error

            toast.success('Card atualizado!')

            onSave({
                ...entry,
                question_text: formData.question_text,
                answer_text: formData.answer_text,
                notes: formData.notes
            })
            onClose()

        } catch (error) {
            console.error('Error updating card:', error)
            toast.error('Erro ao salvar alterações')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="text-lg font-bold text-white">Edição Rápida</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Pergunta</label>
                        <textarea
                            value={formData.question_text}
                            onChange={e => setFormData(prev => ({ ...prev, question_text: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-y"
                            placeholder="Digite a pergunta..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Resposta</label>
                        <textarea
                            value={formData.answer_text}
                            onChange={e => setFormData(prev => ({ ...prev, answer_text: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 min-h-[150px] resize-y"
                            placeholder="Digite a resposta..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Anotações (Opcional)</label>
                        <textarea
                            value={formData.notes}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 min-h-[80px] resize-y"
                            placeholder="Anotações extras..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-white font-medium transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    )
}
