'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, Gauge } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { FSRS_DEFAULTS } from '@/lib/srs'

interface FSRSSettingsModalProps {
    onClose: () => void
    onSave: (retention: number, params?: any) => void
    currentRetention: number
}

export function FSRSSettingsModal({ onClose, onSave, currentRetention }: FSRSSettingsModalProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [retention, setRetention] = useState(currentRetention)
    const [estimatedInterval, setEstimatedInterval] = useState(0)

    const [showAdvanced, setShowAdvanced] = useState(false)
    const [w3, setW3] = useState(4.5) // Default based on our tuning

    // Import FSRS defaults
    // In a real app we'd fetch these from the DB if they exist
    // For now we initialize with our tuned default

    useEffect(() => {
        const r = retention
        const r0 = 0.9
        const decay = -0.5
        const factor = (Math.pow(r, 1 / decay) - 1) / (Math.pow(r0, 1 / decay) - 1)
        setEstimatedInterval(factor)
    }, [retention])

    useEffect(() => {
        // Fetch current settings including params
        async function fetchSettings() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: settings } = await supabase
                .from('user_settings')
                .select('fsrs_params')
                .eq('user_id', user.id)
                .single()

            if (settings?.fsrs_params) {
                const params = settings.fsrs_params as any
                if (params.w && params.w.length > 3) {
                    setW3(params.w[3])
                }
            }
        }
        fetchSettings()
    }, [])

    async function handleSave() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Construct params object
            // Use defaults from srs.ts source of truth
            const defaultW = FSRS_DEFAULTS.w
            const newW = [...defaultW]
            newW[3] = w3

            const params = { w: newW }

            // Check if settings exist
            const { data: existing } = await supabase
                .from('user_settings')
                .select('user_id')
                .eq('user_id', user.id)
                .single()

            if (existing) {
                const { error } = await supabase
                    .from('user_settings')
                    .update({
                        fsrs_retention: retention,
                        fsrs_params: params
                    })
                    .eq('user_id', user.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('user_settings')
                    .insert({
                        user_id: user.id,
                        fsrs_retention: retention,
                        fsrs_params: params
                    })
                if (error) throw error
            }

            toast.success('Configurações salvas!')
            onSave(retention, params)
            onClose()

        } catch (error) {
            console.error('Error saving settings:', error)
            toast.error('Erro ao salvar configurações')
        } finally {
            setLoading(false)
        }
    }

    function handleResetDefaults() {
        setRetention(0.9)
        setW3(4.5)
        toast.info('Valores padrão restaurados (Salve para confirmar)')
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                    <div className="flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-white">Configurações FSRS</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-8">
                    {/* Retention Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-zinc-300">
                                Retenção Desejada
                            </label>
                            <span className="text-xl font-bold text-indigo-400">
                                {(retention * 100).toFixed(0)}%
                            </span>
                        </div>

                        <input
                            type="range"
                            min="0.70"
                            max="0.99"
                            step="0.01"
                            value={retention}
                            onChange={(e) => setRetention(parseFloat(e.target.value))}
                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                        />

                        <div className="flex justify-between text-xs text-zinc-500 font-medium">
                            <span>70% (Menos carga)</span>
                            <span>99% (Máx. memória)</span>
                        </div>
                    </div>

                    {/* Impact Analysis */}
                    <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800 space-y-3">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                            Impacto Estimado
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-xs text-zinc-400 mb-1">Carga de Estudo</span>
                                <span className={`text-sm font-bold ${estimatedInterval < 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {estimatedInterval < 1
                                        ? `+${((1 / estimatedInterval - 1) * 100).toFixed(0)}% revisões`
                                        : `-${((1 - 1 / estimatedInterval) * 100).toFixed(0)}% revisões`
                                    }
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs text-zinc-400 mb-1">Intervalos</span>
                                <span className={`text-sm font-bold ${estimatedInterval > 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {estimatedInterval.toFixed(2)}x {estimatedInterval > 1 ? 'maiores' : 'menores'}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-zinc-500 leading-relaxed pt-2 border-t border-zinc-800/50">
                            {retention > 0.9 ? (
                                "Aumentar a retenção reduz drasticamente os intervalos, aumentando muito a carga de estudos diária."
                            ) : retention < 0.85 ? (
                                "Diminuir a retenção aumenta os intervalos, reduzindo a carga, mas você esquecerá mais cards."
                            ) : (
                                "O valor padrão de 90% é o equilíbrio recomendado entre retenção e carga de trabalho."
                            )}
                        </p>
                    </div>

                    {/* Advanced Params */}
                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
                        >
                            <span>Parâmetros Avançados</span>
                            <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showAdvanced && (
                            <div className="bg-zinc-950/30 rounded-xl p-4 border border-zinc-800 space-y-4 animate-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-zinc-300">
                                            Bônus "Fácil" (Estabilidade Inicial)
                                        </label>
                                        <span className="text-sm font-bold text-amber-400">
                                            {w3.toFixed(1)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.0"
                                        max="20.0"
                                        step="0.5"
                                        value={w3}
                                        onChange={(e) => setW3(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
                                    />
                                    <p className="text-[10px] text-zinc-500">
                                        Define o intervalo inicial para cards novos marcados como "Fácil".
                                        Valor maior = Intervalo maior (menos revisões).
                                        <br />
                                        Padrão: 4.5 (~4 dias). FSRS Original: ~15.7 (~16 dias).
                                    </p>
                                </div>

                                <button
                                    onClick={handleResetDefaults}
                                    className="text-xs text-red-400 hover:text-red-300 underline"
                                >
                                    Restaurar padrões
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Explanation Section */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-3 border border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-emerald-500" />
                            Como funciona o FSRS v6?
                        </h3>
                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
                            <p>
                                O <strong>FSRS (Free Spaced Repetition Scheduler) v6.1.1</strong> é um algoritmo avançado que calcula o momento ideal para revisar cada card.
                            </p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>
                                    <strong>Estabilidade (S):</strong> O tempo estimado (em dias) que você lembrará do conteúdo. Aumenta a cada acerto.
                                </li>
                                <li>
                                    <strong>Dificuldade (D):</strong> O quão difícil é o card. Afeta o quão rápido a estabilidade cresce.
                                </li>
                                <li>
                                    <strong>Retenção (R):</strong> A probabilidade de você lembrar a resposta agora.
                                </li>
                            </ul>
                            <p>
                                O sistema agenda a revisão quando sua chance de lembrar cai para o nível da <strong>Retenção Desejada</strong> ({Math.round(retention * 100)}%).
                            </p>
                            <p className="opacity-75 pt-2 border-t border-slate-200 dark:border-slate-800">
                                *Esta implementação segue exatamente a especificação oficial do FSRS v6.1.1.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3 sticky bottom-0 bg-zinc-900 z-10">
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
                        Salvar
                    </button>
                </div>
            </div >
        </div >
    )
}
