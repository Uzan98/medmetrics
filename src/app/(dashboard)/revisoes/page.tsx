'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton, EmptyState, AccuracyBadge } from '@/components/ui'
import {
    Calendar,
    CheckCircle2,
    Clock,
    Filter,
    ChevronLeft,
    ChevronRight,
    CalendarCheck,
    AlertCircle,
} from 'lucide-react'
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import type { ScheduledReview } from '@/types/database'

interface ReviewWithRelations extends ScheduledReview {
    disciplines: { name: string } | null
    subdisciplines: { name: string } | null
    question_logs: {
        topics: { name: string } | null
    } | null
}

export default function RevisoesPage() {
    const [reviews, setReviews] = useState<ReviewWithRelations[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending')
    const [completing, setCompleting] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        loadReviews()
    }, [filter])

    async function loadReviews() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let query = supabase
                .from('scheduled_reviews')
                .select(`
                    *,
                    disciplines(name),
                    subdisciplines(name),
                    question_logs (
                        topics (
                            name
                        )
                    )
                `)
                .eq('user_id', user.id)
                .order('scheduled_date', { ascending: true })

            if (filter === 'pending') {
                query = query.eq('completed', false)
            } else if (filter === 'completed') {
                query = query.eq('completed', true)
            }

            const { data, error } = await query

            if (error) throw error
            setReviews((data as any) || [])
        } catch (error) {
            console.error('Error loading reviews:', error)
        } finally {
            setLoading(false)
        }
    }

    async function completeReview(id: string) {
        setCompleting(id)
        try {
            const { error } = await supabase
                .from('scheduled_reviews')
                .update({
                    completed: true,
                    completed_at: new Date().toISOString(),
                })
                .eq('id', id)

            if (error) throw error
            await loadReviews()
        } catch (error) {
            console.error('Error completing review:', error)
        } finally {
            setCompleting(null)
        }
    }

    function getDateLabel(dateStr: string) {
        const date = new Date(dateStr + 'T12:00:00')
        if (isToday(date)) return 'Hoje'
        if (isTomorrow(date)) return 'Amanhã'
        if (isPast(date)) return 'Atrasada'
        return format(date, "dd 'de' MMMM", { locale: ptBR })
    }

    function getDateColor(dateStr: string, completed: boolean) {
        if (completed) return 'text-green-400'
        const date = new Date(dateStr + 'T12:00:00')
        if (isPast(date) && !isToday(date)) return 'text-red-400'
        if (isToday(date)) return 'text-yellow-400'
        return 'text-blue-400'
    }

    function getReviewTypeBadge(type: string) {
        const badges = {
            '1d': { label: '1 dia', color: 'bg-blue-500/20 text-blue-400' },
            '7d': { label: '7 dias', color: 'bg-purple-500/20 text-purple-400' },
            '30d': { label: '30 dias', color: 'bg-green-500/20 text-green-400' },
        }
        const badge = badges[type as keyof typeof badges] || badges['1d']
        return (
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${badge.color}`}>
                {badge.label}
            </span>
        )
    }

    // Agrupar revisões por data
    const groupedReviews = reviews.reduce((acc, review) => {
        const dateKey = review.scheduled_date
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(review)
        return acc
    }, {} as { [key: string]: ReviewWithRelations[] })

    // Stats
    const pendingCount = reviews.filter(r => !r.completed).length
    const overdueCount = reviews.filter(r => !r.completed && isPast(new Date(r.scheduled_date + 'T12:00:00')) && !isToday(new Date(r.scheduled_date + 'T12:00:00'))).length
    const todayCount = reviews.filter(r => !r.completed && isToday(new Date(r.scheduled_date + 'T12:00:00'))).length

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Revisões Agendadas</h1>
                <p className="text-slate-400">Acompanhe suas revisões espaçadas</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{todayCount}</p>
                            <p className="text-sm text-slate-400">Para hoje</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{overdueCount}</p>
                            <p className="text-sm text-slate-400">Atrasadas</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{pendingCount}</p>
                            <p className="text-sm text-slate-400">Pendentes</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'pending'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:text-white'
                        }`}
                >
                    Pendentes
                </button>
                <button
                    onClick={() => setFilter('completed')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'completed'
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:text-white'
                        }`}
                >
                    Concluídas
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all'
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:text-white'
                        }`}
                >
                    Todas
                </button>
            </div>

            {/* Reviews List */}
            {reviews.length === 0 ? (
                <EmptyState
                    icon={CalendarCheck}
                    title={filter === 'pending' ? 'Nenhuma revisão pendente' : 'Nenhuma revisão encontrada'}
                    description={filter === 'pending'
                        ? 'Suas revisões agendadas aparecerão aqui. Registre mais questões para criar revisões!'
                        : 'Não há revisões para este filtro.'
                    }
                    action={
                        <Link
                            href="/registrar"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all"
                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                        >
                            Registrar Questões
                        </Link>
                    }
                />
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedReviews).map(([date, dateReviews]) => (
                        <div key={date}>
                            <h3 className={`text-sm font-medium mb-3 ${getDateColor(date, false)}`}>
                                {getDateLabel(date)}
                                <span className="text-slate-500 ml-2">
                                    ({format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy')})
                                </span>
                            </h3>
                            <div className="space-y-2">
                                {dateReviews.map((review) => (
                                    <div
                                        key={review.id}
                                        className={`bg-slate-800/50 rounded-xl p-4 border transition-all ${review.completed
                                            ? 'border-green-500/30 opacity-60'
                                            : 'border-slate-700/50 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {review.completed ? (
                                                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                                        <Calendar className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-white">
                                                        {review.question_logs?.topics?.name || review.disciplines?.name || 'Sem tópico'}
                                                    </p>
                                                    {(review.subdisciplines?.name || review.disciplines?.name) && (
                                                        <p className="text-sm text-slate-400">
                                                            {review.disciplines?.name} {review.subdisciplines?.name ? `• ${review.subdisciplines.name}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {getReviewTypeBadge(review.review_type)}
                                                {!review.completed && (
                                                    <button
                                                        onClick={() => completeReview(review.id)}
                                                        disabled={completing === review.id}
                                                        className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                                    >
                                                        {completing === review.id ? 'Salvando...' : 'Concluir'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
