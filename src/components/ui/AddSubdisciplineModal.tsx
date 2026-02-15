'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Loader2 } from 'lucide-react'

interface AddSubdisciplineModalProps {
    isOpen: boolean
    onClose: () => void
    disciplineId: number
    disciplineName: string
    onCreated: (subdiscipline: { id: number; name: string }) => void
}

export function AddSubdisciplineModal({
    isOpen,
    onClose,
    disciplineId,
    disciplineName,
    onCreated,
}: AddSubdisciplineModalProps) {
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
            const { data, error: insertError } = await supabase
                .from('subdisciplines')
                .insert({
                    name: name.trim(),
                    discipline_id: disciplineId,
                })
                .select()
                .single()

            if (insertError) throw insertError

            onCreated({ id: data.id, name: data.name })
            setName('')
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar subdisciplina')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-zinc-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-zinc-700 shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Nova Subdisciplina</h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            Será adicionada em <span className="text-blue-400 font-medium">{disciplineName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Nome da Subdisciplina
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Cardiologia, Nefrologia..."
                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl font-medium text-zinc-300 bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02]"
                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    Criar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
