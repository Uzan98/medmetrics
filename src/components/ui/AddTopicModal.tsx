'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save } from 'lucide-react'

interface AddTopicModalProps {
    isOpen: boolean
    onClose: () => void
    subdisciplineId: number
    subdisciplineName: string
    onCreated: (topic: { id: number; name: string }) => void
}

export function AddTopicModal({ isOpen, onClose, subdisciplineId, subdisciplineName, onCreated }: AddTopicModalProps) {
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    if (!isOpen) return null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        setError(null)

        try {
            // Check if exists
            const { data: existing } = await supabase
                .from('topics')
                .select('id')
                .eq('subdiscipline_id', subdisciplineId)
                .ilike('name', name.trim())
                .single()

            if (existing) {
                throw new Error('Este assunto já existe nesta subdisciplina')
            }

            const { data, error } = await supabase
                .from('topics')
                .insert({
                    name: name.trim(),
                    subdiscipline_id: subdisciplineId
                })
                .select('id, name')
                .single()

            if (error) throw error

            onCreated(data)
            setName('')
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar assunto')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-white mb-2">Novo Assunto</h2>
                <p className="text-sm text-zinc-400 mb-6">
                    Adicionando assunto em <span className="text-blue-400 font-medium">{subdisciplineName}</span>
                </p>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Nome do Assunto
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Insuficiência Cardíaca, IAM..."
                            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
