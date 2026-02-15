'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import { FlashcardDisplay } from './FlashcardDisplay'
import {
    X,
    ChevronLeft,
    ChevronRight,
    Flame,
    Star,
    Trophy,
    Zap,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Sparkles,
    PartyPopper,
    Target,
    Timer
} from 'lucide-react'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import confetti from 'canvas-confetti'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { name: string } | null
    image_urls: string[] | null
    error_type: 'knowledge_gap' | 'interpretation' | 'distraction' | 'reasoning' | null
    action_item: string | null
}

interface StudyModeProps {
    entries: ErrorEntry[]
    disciplineId?: number | 'all'
    onClose: () => void
    onSessionComplete: (stats: SessionStats) => void
}

interface SessionStats {
    cardsStudied: number
    cardsEasy: number
    cardsHard: number
    cardsWrong: number
    xpEarned: number
    timeSpent: number
}

// XP rewards
const XP_REWARDS = {
    easy: 15,
    hard: 10,
    wrong: 5,
    streak_bonus: 5, // per streak level
    session_complete: 50
}

import { calculateNextReview, ReviewResult } from '@/lib/srs'

// ... existing imports ...

// Spaced repetition intervals - REMOVED (No longer used)
// const REVIEW_INTERVALS = { ... }

export function StudyMode({ entries, disciplineId, onClose, onSessionComplete }: StudyModeProps) {
    const supabase = createClient()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [showRating, setShowRating] = useState(false)
    const [streak, setStreak] = useState(0)
    const [xpAnimation, setXpAnimation] = useState({ amount: 0, show: false })
    const [showComplete, setShowComplete] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)

    // Stats state
    const [sessionStats, setSessionStats] = useState<SessionStats>({
        cardsStudied: 0,
        cardsEasy: 0,
        cardsHard: 0,
        cardsWrong: 0,
        xpEarned: 0,
        timeSpent: 0
    })

    const startTime = useRef(Date.now())

    const filteredEntries = disciplineId && disciplineId !== 'all'
        ? entries.filter(e => e.discipline_id === disciplineId)
        : entries

    const currentCard = filteredEntries[currentIndex]

    // Initialize session
    useEffect(() => {
        async function initSession() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data, error } = await supabase
                    .from('study_sessions')
                    .insert({
                        user_id: user.id,
                        discipline_id: disciplineId === 'all' ? null : disciplineId
                    })
                    .select()
                    .single()

                if (data) setSessionId(data.id)
            } catch (error) {
                console.error('Error starting session:', error)
            }
        }
        initSession()
    }, [])

    const goToNext = useCallback(() => {
        if (currentIndex < filteredEntries.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setIsFlipped(false)
            setShowRating(false)
        }
    }, [currentIndex, filteredEntries.length])

    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
            setIsFlipped(false)
            setShowRating(false)
        }
    }, [currentIndex])

    function getAccentColor(disciplineName?: string) {
        if (!disciplineName) return 'indigo'
        const lower = disciplineName.toLowerCase()
        if (lower.includes('cardio') || lower.includes('coracao')) return 'rose'
        if (lower.includes('pediatria') || lower.includes('crianca')) return 'cyan'
        if (lower.includes('gineco') || lower.includes('mulher')) return 'pink'
        if (lower.includes('cirurgia')) return 'emerald'
        if (lower.includes('preventiva') || lower.includes('sus')) return 'amber'
        return 'indigo'
    }

    async function handleRating(difficulty: 'easy' | 'hard' | 'wrong') {
        const card = currentCard
        if (!card) return

        // Calculate XP
        let xp = XP_REWARDS[difficulty]
        if (difficulty !== 'wrong') {
            setStreak(prev => prev + 1)
            xp += Math.min(streak, 10) * XP_REWARDS.streak_bonus
        } else {
            setStreak(0)
        }

        // Show XP animation
        setXpAnimation({ amount: xp, show: true })
        setTimeout(() => setXpAnimation({ amount: 0, show: false }), 1000)

        // Update stats
        setSessionStats(prev => ({
            ...prev,
            cardsStudied: prev.cardsStudied + 1,
            cardsEasy: prev.cardsEasy + (difficulty === 'easy' ? 1 : 0),
            cardsHard: prev.cardsHard + (difficulty === 'hard' ? 1 : 0),
            cardsWrong: prev.cardsWrong + (difficulty === 'wrong' ? 1 : 0),
            xpEarned: prev.xpEarned + xp
        }))

        // Calculate SRS parameters
        // Map UI difficulty to SM-2 Quality (0-5)
        // wrong -> 0 (Fail)
        // hard -> 3 (Pass, with difficulty)
        // easy -> 5 (Pass, perfect)
        const quality = difficulty === 'wrong' ? 0 : difficulty === 'hard' ? 3 : 5

        const srsResult = calculateNextReview(
            quality,
            card.interval || 0,
            card.ease_factor || 2.5
            // defaults if null (new cards might be null if not covered by default constraint, but we added default in migration)
        )

        // Save to database
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Save flashcard review
            await supabase.from('flashcard_reviews').insert({
                user_id: user.id,
                flashcard_id: card.id,
                session_id: sessionId,
                difficulty,
                xp_earned: xp
            })

            // Update flashcard with next review date and SRS params
            await supabase
                .from('error_notebook')
                .update({
                    last_reviewed_at: new Date().toISOString(),
                    next_review_date: format(srsResult.nextReviewDate, 'yyyy-MM-dd'),
                    difficulty_level: difficulty === 'wrong' ? 0 : difficulty === 'hard' ? 1 : 2,
                    review_count: (card.review_count || 0) + 1,
                    interval: srsResult.interval,
                    ease_factor: srsResult.easeFactor
                })
                .eq('id', card.id)

            // Note: We are using error_notebook for scheduling now.

        } catch (error) {
            console.error('Error saving review:', error)
            toast.error('Erro ao salvar progresso')
        }

        // ... navigation ...

        // Move to next or complete
        if (currentIndex === filteredEntries.length - 1) {
            completeSession()
        } else {
            setTimeout(() => {
                goToNext()
            }, 300)
        }
    }

    async function completeSession() {
        const timeSpent = Math.floor((Date.now() - startTime.current) / 1000)
        const finalXp = sessionStats.xpEarned + XP_REWARDS.session_complete

        // Update stats with final values
        const finalStats = {
            ...sessionStats,
            xpEarned: finalXp,
            timeSpent
        }
        setSessionStats(finalStats)

        // Confetti celebration!
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899']
        })

        // Update session in database
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            if (sessionId) {
                await supabase
                    .from('study_sessions')
                    .update({
                        completed_at: new Date().toISOString(),
                        cards_studied: finalStats.cardsStudied,
                        cards_easy: finalStats.cardsEasy,
                        cards_hard: finalStats.cardsHard,
                        cards_wrong: finalStats.cardsWrong,
                        xp_earned: finalStats.xpEarned
                    })
                    .eq('id', sessionId)
            }

            // Update user study stats
            const today = format(new Date(), 'yyyy-MM-dd')

            // Check if user has stats
            const { data: existingStats } = await supabase
                .from('user_study_stats')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (existingStats) {
                const lastStudyDate = existingStats.last_study_date
                const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')

                let newStreak = existingStats.current_streak
                if (lastStudyDate === yesterday) {
                    newStreak += 1
                } else if (lastStudyDate !== today) {
                    newStreak = 1
                }

                await supabase
                    .from('user_study_stats')
                    .update({
                        current_streak: newStreak,
                        longest_streak: Math.max(newStreak, existingStats.longest_streak),
                        last_study_date: today,
                        total_xp: existingStats.total_xp + finalStats.xpEarned,
                        total_cards_reviewed: existingStats.total_cards_reviewed + finalStats.cardsStudied,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)
            } else {
                await supabase.from('user_study_stats').insert({
                    user_id: user.id,
                    current_streak: 1,
                    longest_streak: 1,
                    last_study_date: today,
                    total_xp: finalStats.xpEarned,
                    total_cards_reviewed: finalStats.cardsStudied
                })
            }

        } catch (error) {
            console.error('Error completing session:', error)
        }

        setShowComplete(true)
        onSessionComplete(finalStats)
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (filteredEntries.length === 0) {
        return (
            <div className="fixed inset-0 bg-zinc-950 z-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
                        <Target className="w-12 h-12 text-zinc-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Nenhum card encontrado</h2>
                    <p className="text-zinc-400 mb-8">Adicione alguns flashcards primeiro!</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        )
    }

    // Session Complete Screen
    if (showComplete) {
        const accuracy = Math.round(((sessionStats.cardsEasy + sessionStats.cardsHard) / sessionStats.cardsStudied) * 100)

        return (
            <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 z-50 flex items-center justify-center p-4">
                <div className="max-w-lg w-full text-center">
                    {/* Celebration Icon */}
                    <div className="relative mb-8">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto shadow-2xl shadow-yellow-500/30 animate-bounce">
                            <Trophy className="w-16 h-16 text-white" />
                        </div>
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center animate-pulse">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black text-white mb-2">
                        Sessão Completa!
                    </h1>
                    <p className="text-xl text-zinc-300 mb-8">
                        Você está arrasando! 🔥
                    </p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-5">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Zap className="w-6 h-6 text-yellow-400" />
                                <span className="text-3xl font-black text-white">{sessionStats.xpEarned}</span>
                            </div>
                            <p className="text-emerald-300 font-medium">XP Ganhos</p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-5">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Target className="w-6 h-6 text-blue-400" />
                                <span className="text-3xl font-black text-white">{accuracy}%</span>
                            </div>
                            <p className="text-blue-300 font-medium">Precisão</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-5">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <CheckCircle2 className="w-6 h-6 text-purple-400" />
                                <span className="text-3xl font-black text-white">{sessionStats.cardsStudied}</span>
                            </div>
                            <p className="text-purple-300 font-medium">Cards Revisados</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-2xl p-5">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Timer className="w-6 h-6 text-orange-400" />
                                <span className="text-3xl font-black text-white">{formatTime(sessionStats.timeSpent)}</span>
                            </div>
                            <p className="text-orange-300 font-medium">Tempo</p>
                        </div>
                    </div>

                    {/* Rating Breakdown */}
                    <div className="bg-zinc-800/50 rounded-2xl p-4 mb-8 flex justify-around">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-bold">{sessionStats.cardsEasy}</span>
                            </div>
                            <span className="text-xs text-zinc-500">Fácil</span>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-bold">{sessionStats.cardsHard}</span>
                            </div>
                            <span className="text-xs text-zinc-500">Difícil</span>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                                <XCircle className="w-4 h-4" />
                                <span className="font-bold">{sessionStats.cardsWrong}</span>
                            </div>
                            <span className="text-xs text-zinc-500">Errei</span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <X className="w-6 h-6 text-zinc-400" />
                </button>

                {/* Progress Bar */}
                <div className="flex-1 max-w-md mx-4">
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${((currentIndex + (showRating ? 1 : 0)) / filteredEntries.length) * 100}%` }}
                        />
                    </div>
                    <p className="text-center text-xs text-zinc-500 mt-1">
                        {currentIndex + 1} / {filteredEntries.length}
                    </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                    {/* Streak */}
                    {streak > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 rounded-full animate-in zoom-in duration-300">
                            <Flame className="w-4 h-4 text-orange-400" />
                            <span className="text-orange-400 font-bold text-sm">{streak}</span>
                        </div>
                    )}

                    {/* XP */}
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 rounded-full relative">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-bold text-sm">{sessionStats.xpEarned}</span>

                        {/* XP Animation */}
                        {xpAnimation.show && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold animate-in zoom-in fade-out duration-500">
                                +{xpAnimation.amount}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-6 relative">
                {/* Navigation Arrows (Desktop) */}
                <button
                    onClick={goToPrevious}
                    disabled={currentIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hidden md:block"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>

                {/* Flashcard */}
                {currentCard && (
                    <FlashcardDisplay
                        question={currentCard.question_text}
                        answer={currentCard.answer_text}
                        notes={currentCard.notes}
                        discipline={currentCard.disciplines?.name}
                        topic={currentCard.topics?.name}
                        images={currentCard.image_urls}
                        errorType={currentCard.error_type}
                        actionItem={currentCard.action_item}
                        isFlipped={isFlipped}
                        onFlip={() => {
                            setIsFlipped(true)
                            setShowRating(true)
                        }}
                        accentColor={getAccentColor(currentCard.disciplines?.name)}
                    />
                )}

                <button
                    onClick={() => {
                        if (!showRating) goToNext()
                    }}
                    disabled={currentIndex === filteredEntries.length - 1 || showRating}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hidden md:block"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            </div>

            {/* Rating Buttons */}
            {showRating && (
                <div className="p-6 border-t border-white/5 animate-in slide-in-from-bottom duration-300">
                    <p className="text-center text-zinc-400 text-sm mb-4">
                        Como você se saiu? (Teclas: 1, 2, 3)
                    </p>
                    <div className="flex gap-4 max-w-lg mx-auto">
                        <button
                            onClick={() => handleRating('wrong')}
                            className="flex-1 py-4 bg-gradient-to-br from-red-500/20 to-red-600/10 hover:from-red-500/30 hover:to-red-600/20 border-2 border-red-500/30 hover:border-red-500/50 text-red-400 rounded-2xl font-bold transition-all flex flex-col items-center gap-1 group"
                        >
                            <XCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span>Errei</span>
                            <span className="text-xs opacity-60">+{XP_REWARDS.wrong} XP</span>
                        </button>

                        <button
                            onClick={() => handleRating('hard')}
                            className="flex-1 py-4 bg-gradient-to-br from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 border-2 border-amber-500/30 hover:border-amber-500/50 text-amber-400 rounded-2xl font-bold transition-all flex flex-col items-center gap-1 group"
                        >
                            <AlertTriangle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span>Difícil</span>
                            <span className="text-xs opacity-60">+{XP_REWARDS.hard} XP</span>
                        </button>

                        <button
                            onClick={() => handleRating('easy')}
                            className="flex-1 py-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 rounded-2xl font-bold transition-all flex flex-col items-center gap-1 group"
                        >
                            <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span>Fácil</span>
                            <span className="text-xs opacity-60">+{XP_REWARDS.easy} XP</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Keyboard Hints */}
            <div className="text-center pb-4 text-xs text-zinc-600">
                Espaço: revelar • ←→: navegar • 1,2,3: avaliar
            </div>
        </div>
    )
}
