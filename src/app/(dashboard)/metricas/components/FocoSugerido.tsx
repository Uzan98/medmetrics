'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui'
import { Crosshair, TrendingDown, TrendingUp, ArrowRight, AlertTriangle } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface FocusSuggestion {
    disciplineName: string
    currentAccuracy: number
    previousAccuracy: number
    trend: number // pp change
    totalQuestions: number
    reason: 'declining' | 'low_accuracy'
}

export default function FocoSugerido() {
    const [suggestions, setSuggestions] = useState<FocusSuggestion[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        loadSuggestions()
    }, [])

    async function loadSuggestions() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const today = new Date()
            const thirtyDaysAgo = subDays(today, 30)
            const sixtyDaysAgo = subDays(today, 60)

            const [recentRes, previousRes, disciplinesRes] = await Promise.all([
                supabase
                    .from('question_logs')
                    .select('discipline_id, questions_done, correct_answers')
                    .eq('user_id', user.id)
                    .gte('date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
                    .lte('date', format(today, 'yyyy-MM-dd')),
                supabase
                    .from('question_logs')
                    .select('discipline_id, questions_done, correct_answers')
                    .eq('user_id', user.id)
                    .gte('date', format(sixtyDaysAgo, 'yyyy-MM-dd'))
                    .lt('date', format(thirtyDaysAgo, 'yyyy-MM-dd')),
                supabase
                    .from('disciplines')
                    .select('id, name')
            ])

            const recent = recentRes.data || []
            const previous = previousRes.data || []
            const disciplines = disciplinesRes.data || []

            const getDisciplineName = (id: number) =>
                disciplines.find(d => d.id === id)?.name || 'Desconhecida'

            // Aggregate recent period (last 30 days)
            const recentMap: { [key: number]: { q: number; c: number } } = {}
            recent.forEach(log => {
                if (!log.discipline_id) return
                if (!recentMap[log.discipline_id]) recentMap[log.discipline_id] = { q: 0, c: 0 }
                recentMap[log.discipline_id].q += log.questions_done
                recentMap[log.discipline_id].c += log.correct_answers
            })

            // Aggregate previous period (30-60 days ago)
            const previousMap: { [key: number]: { q: number; c: number } } = {}
            previous.forEach(log => {
                if (!log.discipline_id) return
                if (!previousMap[log.discipline_id]) previousMap[log.discipline_id] = { q: 0, c: 0 }
                previousMap[log.discipline_id].q += log.questions_done
                previousMap[log.discipline_id].c += log.correct_answers
            })

            // Build suggestions
            const allDisciplineIds = new Set([
                ...Object.keys(recentMap).map(Number),
                ...Object.keys(previousMap).map(Number)
            ])

            const items: FocusSuggestion[] = []

            allDisciplineIds.forEach(id => {
                const rec = recentMap[id]
                const prev = previousMap[id]

                if (!rec || rec.q < 5) return // Need minimum data

                const currentAccuracy = rec.q > 0 ? (rec.c / rec.q) * 100 : 0
                const previousAccuracy = prev && prev.q > 0 ? (prev.c / prev.q) * 100 : currentAccuracy
                const trend = currentAccuracy - previousAccuracy

                // Declining performance (trend < -3pp)
                if (trend < -3 && prev && prev.q >= 5) {
                    items.push({
                        disciplineName: getDisciplineName(id),
                        currentAccuracy,
                        previousAccuracy,
                        trend,
                        totalQuestions: rec.q,
                        reason: 'declining'
                    })
                }
                // Low accuracy (< 60%) regardless of trend
                else if (currentAccuracy < 60) {
                    items.push({
                        disciplineName: getDisciplineName(id),
                        currentAccuracy,
                        previousAccuracy,
                        trend,
                        totalQuestions: rec.q,
                        reason: 'low_accuracy'
                    })
                }
            })

            // Sort: declining first (by trend asc), then low accuracy (by accuracy asc)
            items.sort((a, b) => {
                if (a.reason === 'declining' && b.reason !== 'declining') return -1
                if (a.reason !== 'declining' && b.reason === 'declining') return 1
                if (a.reason === 'declining') return a.trend - b.trend
                return a.currentAccuracy - b.currentAccuracy
            })

            setSuggestions(items.slice(0, 3))
        } catch (error) {
            console.error('Error loading focus suggestions:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
        )
    }

    if (suggestions.length === 0) return null

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">Foco Sugerido</h2>
                <span className="text-xs text-zinc-500">baseado nos últimos 30 dias</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {suggestions.map((item, idx) => (
                    <div
                        key={item.disciplineName}
                        className={`relative overflow-hidden rounded-xl border p-4 transition-all ${item.reason === 'declining'
                                ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                                : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                            }`}
                    >
                        {/* Priority badge */}
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-red-500/20 text-red-400' :
                                idx === 1 ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-zinc-500/20 text-zinc-400'
                            }`}>
                            {idx + 1}
                        </div>

                        <h3 className="font-semibold text-white text-sm truncate pr-6">
                            {item.disciplineName}
                        </h3>

                        <div className="flex items-center gap-3 mt-2">
                            <span className={`text-xl font-bold ${item.currentAccuracy < 50 ? 'text-red-400' :
                                    item.currentAccuracy < 70 ? 'text-amber-400' :
                                        'text-zinc-300'
                                }`}>
                                {item.currentAccuracy.toFixed(0)}%
                            </span>

                            {item.trend !== 0 && (
                                <div className={`flex items-center gap-1 text-xs font-medium ${item.trend < 0 ? 'text-red-400' : 'text-green-400'
                                    }`}>
                                    {item.trend < 0
                                        ? <TrendingDown className="w-3.5 h-3.5" />
                                        : <TrendingUp className="w-3.5 h-3.5" />
                                    }
                                    {item.trend > 0 ? '+' : ''}{item.trend.toFixed(0)}pp
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-zinc-500 mt-1.5">
                            {item.reason === 'declining'
                                ? 'Desempenho em queda'
                                : 'Acurácia abaixo do ideal'
                            }
                            {' · '}{item.totalQuestions} questões
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
