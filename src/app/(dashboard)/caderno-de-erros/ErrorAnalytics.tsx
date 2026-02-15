'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { X, TrendingUp, AlertCircle, Brain, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ErrorAnalyticsProps {
    isOpen: boolean
    onClose: () => void
    userId: string
}

export function ErrorAnalytics({ isOpen, onClose, userId }: ErrorAnalyticsProps) {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<{
        byDiscipline: any[]
        byType: any[]
        retentionRate: number
        totalReviews: number
    }>({
        byDiscipline: [],
        byType: [],
        retentionRate: 0,
        totalReviews: 0
    })

    const supabase = createClient()

    useEffect(() => {
        if (isOpen) {
            loadStats()
        }
    }, [isOpen])

    async function loadStats() {
        setLoading(true)
        try {
            // Fetch error entries for current distribution
            const { data: errors } = await supabase
                .from('error_notebook')
                .select(`
                    id,
                    error_type,
                    disciplines(name)
                `)
                .eq('user_id', userId)

            // Fetch review history for retention rate
            const { data: reviews } = await supabase
                .from('flashcard_reviews')
                .select('difficulty')
                .eq('user_id', userId)
                .limit(1000) // Limit to last 1000 reviews for performance

            // Process By Discipline
            const discCount: Record<string, number> = {}
            errors?.forEach(e => {
                const name = e.disciplines?.name || 'Sem disciplina'
                discCount[name] = (discCount[name] || 0) + 1
            })
            const byDiscipline = Object.entries(discCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Process By Type
            const typeMap: Record<string, string> = {
                'knowledge_gap': 'Lacuna de Conhecimento',
                'interpretation': 'Interpretação',
                'distraction': 'Falta de Atenção',
                'reasoning': 'Raciocínio'
            }
            const typeCount: Record<string, number> = {}
            errors?.forEach(e => {
                const type = e.error_type ? typeMap[e.error_type] || e.error_type : 'Não classificado'
                typeCount[type] = (typeCount[type] || 0) + 1
            })
            const byType = Object.entries(typeCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Process Retention
            let correct = 0
            reviews?.forEach(r => {
                if (r.difficulty === 'easy' || r.difficulty === 'hard') correct++
            })
            const retentionRate = reviews && reviews.length > 0
                ? (correct / reviews.length) * 100
                : 0

            setStats({
                byDiscipline,
                byType,
                retentionRate,
                totalReviews: reviews?.length || 0
            })

        } catch (error) {
            console.error('Error loading analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#6366f1']

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#09090b] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-700/50 shadow-2xl"
                >
                    <div className="p-6 border-b border-zinc-700/50 flex items-center justify-between sticky top-0 bg-[#09090b]/95 backdrop-blur z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Brain className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Análise de Erros</h2>
                                <p className="text-sm text-zinc-400">Entenda onde você precisa focar</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-8">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                            </div>
                        ) : (
                            <>
                                {/* KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Target className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm text-zinc-400">Taxa de Retenção</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white">
                                            {stats.retentionRate.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-zinc-400">Revisões Totais</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white">{stats.totalReviews}</p>
                                    </div>
                                    <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-4 h-4 text-rose-400" />
                                            <span className="text-sm text-zinc-400">Top Disciplina Errada</span>
                                        </div>
                                        <p className="text-lg font-bold text-white truncate">
                                            {stats.byDiscipline[0]?.name || '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Discipline Distribution */}
                                    <div className="bg-zinc-800/30 p-6 rounded-3xl border border-zinc-700/30">
                                        <h3 className="text-lg font-semibold text-white mb-6">Por Disciplina</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={stats.byDiscipline}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {stats.byDiscipline.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Error Type Distribution */}
                                    <div className="bg-zinc-800/30 p-6 rounded-3xl border border-zinc-700/30">
                                        <h3 className="text-lg font-semibold text-white mb-6">Por Tipo de Erro</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={stats.byType} layout="vertical" margin={{ left: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                                    <XAxis type="number" stroke="#64748b" />
                                                    <YAxis dataKey="name" type="category" width={100} stroke="#a1a1aa" fontSize={12} />
                                                    <Tooltip
                                                        cursor={{ fill: '#27272a', opacity: 0.2 }}
                                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
                                                    />
                                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                                        {stats.byType.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
