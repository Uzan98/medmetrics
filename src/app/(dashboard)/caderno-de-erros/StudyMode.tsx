'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import { FlashcardDisplay } from './FlashcardDisplay'
import { QuickEditModal } from './components/QuickEditModal'
import { FSRSSettingsModal } from './components/FSRSSettingsModal'
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
    Timer,
    Settings2
} from 'lucide-react'
import { toast } from 'sonner'
import { addDays, format, differenceInDays } from 'date-fns'
import confetti from 'canvas-confetti'

type ErrorEntry = Database['public']['Tables']['error_notebook']['Row'] & {
    disciplines: { name: string } | null
    topics: { id: number; name: string; subdiscipline_id: number | null } | null
    image_urls: string[] | null
    error_type: 'knowledge_gap' | 'interpretation' | 'distraction' | 'reasoning' | null
    action_item: string | null
    // FSRS fields (optional until types are fully regenerated)
    stability?: number
    difficulty?: number
    state?: number
    lapses?: number
}

interface StudyModeProps {
    entries: ErrorEntry[]
    disciplineId?: number | 'all'
    subdisciplineId?: number | 'all'
    topicId?: number | 'all'
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

export function StudyMode({ entries, disciplineId, subdisciplineId, topicId, onClose, onSessionComplete }: StudyModeProps) {
    const supabase = createClient()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [showRating, setShowRating] = useState(false)
    const [streak, setStreak] = useState(0)
    const [xpAnimation, setXpAnimation] = useState({ amount: 0, show: false })
    const [showComplete, setShowComplete] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [requestRetention, setRequestRetention] = useState(0.9)
    const [fsrsParams, setFsrsParams] = useState<any>(null)
    const [showSettings, setShowSettings] = useState(false)

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

    // Build initial study queue from filtered entries
    const initialQueue = entries.filter(e => {
        const matchDiscipline = !disciplineId || disciplineId === 'all' || e.discipline_id === disciplineId
        const matchSubdiscipline = !subdisciplineId || subdisciplineId === 'all' || e.topics?.subdiscipline_id === subdisciplineId
        const matchTopic = !topicId || topicId === 'all' || e.topic_id === topicId
        return matchDiscipline && matchSubdiscipline && matchTopic
    })

    const [studyQueue, setStudyQueue] = useState<ErrorEntry[]>(initialQueue)
    const [totalToStudy] = useState(initialQueue.length) // original count for progress bar
    const [passedCount, setPassedCount] = useState(0)

    const currentCard = studyQueue[currentIndex]

    // Initialize session and fetch settings
    useEffect(() => {
        async function initSession() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // Fetch User Settings
                const { data: settings } = await supabase
                    .from('user_settings')
                    .select('fsrs_retention,fsrs_params')
                    .eq('user_id', user.id)
                    .single()

                if (settings && settings.fsrs_retention) {
                    setRequestRetention(settings.fsrs_retention)
                }
                if (settings && settings.fsrs_params) {
                    setFsrsParams(settings.fsrs_params)
                }

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
        if (currentIndex < studyQueue.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setIsFlipped(false)
            setShowRating(false)
        }
    }, [currentIndex, studyQueue.length])

    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
            setIsFlipped(false)
            setShowRating(false)
        }
    }, [currentIndex])

    // Edit Mode State
    const [editingCard, setEditingCard] = useState<ErrorEntry | null>(null)

    function handleSaveEdit(updatedEntry: ErrorEntry) {
        setStudyQueue(prev => prev.map(card =>
            card.id === updatedEntry.id ? updatedEntry : card
        ))
        setEditingCard(null)
    }

    // Keyboard shortcut for Edit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'e' && !editingCard && !showComplete) {
                e.preventDefault()
                const card = studyQueue[currentIndex]
                if (card) setEditingCard(card)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentIndex, studyQueue, editingCard, showComplete])

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

    // Undo State
    const [undoState, setUndoState] = useState<{
        card: ErrorEntry
        reviewId: string
        previousStats: SessionStats
        previousStreak: number
        wasWrong: boolean
        previousIndex: number
        lastDifficulty: 'easy' | 'hard' | 'wrong'
        previousDbData: {
            last_reviewed_at: string | null
            next_review_date: string | null
            interval: number | null | undefined
            stability: number | null | undefined
            difficulty: number | null | undefined
            state: number | null | undefined
            lapses: number | null | undefined
            review_count: number
        }
    } | null>(null)

    // Trigger Toast when undo state changes
    useEffect(() => {
        if (undoState) {
            const { lastDifficulty } = undoState
            const description = lastDifficulty === 'easy' ? 'Fácil (+15 XP)' : lastDifficulty === 'hard' ? 'Difícil (+10 XP)' : 'Errei (+5 XP)'

            toast('Avaliação registrada', {
                description,
                action: {
                    label: 'Desfazer',
                    onClick: handleUndo
                },
                duration: 4000
            })
        }
    }, [undoState])

    async function handleUndo() {
        if (!undoState) return
        const { card, reviewId, previousStats, previousStreak, wasWrong, previousIndex, previousDbData } = undoState

        // 1. Revert UI State
        setSessionStats(previousStats)
        setStreak(previousStreak)
        setPassedCount(prev => wasWrong ? prev : prev - 1)

        // 2. Revert Queue/Index
        if (wasWrong) {
            setStudyQueue(prev => prev.slice(0, -1)) // Remove the appended card
        }
        setCurrentIndex(previousIndex)
        setIsFlipped(true)
        setShowRating(true)

        setUndoState(null)
        toast.dismiss()
        toast.success('Ação desfeita!')

        // 3. Revert Database
        try {
            await supabase.from('flashcard_reviews').delete().eq('id', reviewId)

            // Fix types for update
            const updatePayload: any = { ...previousDbData }

            await supabase
                .from('error_notebook')
                .update(updatePayload)
                .eq('id', card.id)
        } catch (error) {
            console.error('Error undoing:', error)
            toast.error('Erro ao reverter no banco de dados')
        }
    }

    // Helper to handle legacy cards (SM-2 migration)
    function getEffectiveCardState(card: ErrorEntry) {
        // If card has FSRS state, use it
        if (card.stability !== undefined && card.stability !== null) {
            return {
                s: card.stability,
                d: card.difficulty || 0,
                state: card.state || 0
            }
        }

        // Migration Logic for Legacy Cards
        // If it has an existing interval but no FSRS state, we seed it:
        // S = Interval
        // D = 5 (Medium difficulty default)
        // State = 2 (Review)
        if (card.interval && card.interval > 0) {
            return {
                s: card.interval,
                d: 5,
                state: 2
            }
        }

        // New Card
        return {
            s: 0,
            d: 0,
            state: 0
        }
    }

    async function handleRating(difficulty: 'easy' | 'hard' | 'wrong') {
        const card = currentCard
        const currentIndexSnapshot = currentIndex
        if (!card) return

        // Save current stats for Undo
        const prevStats = { ...sessionStats }
        const prevStreak = streak

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

        // Save review attempt to database
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Insert review and get ID
            const { data: reviewData } = await supabase.from('flashcard_reviews').insert({
                user_id: user.id,
                flashcard_id: card.id,
                session_id: sessionId,
                difficulty,
                xp_earned: xp
            }).select().single()

            if (reviewData) {
                // Prepare Undo State
                setUndoState({
                    card,
                    reviewId: reviewData.id,
                    previousStats: prevStats,
                    previousStreak: prevStreak,
                    wasWrong: difficulty === 'wrong',
                    previousIndex: currentIndexSnapshot,
                    lastDifficulty: difficulty,
                    previousDbData: {
                        last_reviewed_at: card.last_reviewed_at,
                        next_review_date: card.next_review_date,
                        interval: card.interval,
                        stability: card.stability,
                        difficulty: card.difficulty,
                        state: card.state,
                        lapses: card.lapses,
                        review_count: card.review_count
                    }
                })
            }

            // Current approach: Always calculate next review state
            const quality = difficulty === 'easy' ? 5 : (difficulty === 'hard' ? 3 : 1) // 1=Wrong

            const lastReviewDate = card.last_reviewed_at ? new Date(card.last_reviewed_at) : new Date()
            const daysSince = card.last_reviewed_at
                ? differenceInDays(new Date(), lastReviewDate)
                : 0

            // Get effective state (handles legacy migration)
            const { s, d, state } = getEffectiveCardState(card)

            const srsResult = calculateNextReview(
                quality,
                s,
                d,
                state,
                daysSince,
                requestRetention,
                fsrsParams
            )

            const updateData: any = {
                last_reviewed_at: new Date().toISOString(),
                next_review_date: format(srsResult.nextReviewDate, 'yyyy-MM-dd'),
                difficulty_level: difficulty === 'hard' ? 1 : 2,
                review_count: (card.review_count || 0) + 1,
                interval: srsResult.interval,
                stability: srsResult.stability,
                difficulty: srsResult.difficulty,
                state: srsResult.state
            }

            if (difficulty === 'wrong') {
                updateData.lapses = (card.lapses || 0) + 1
            }

            await supabase
                .from('error_notebook')
                .update(updateData)
                .eq('id', card.id)
        } catch (error) {
            console.error('Error saving review:', error)
            toast.error('Erro ao salvar progresso')
        }

        // Navigation
        if (difficulty === 'wrong') {
            setStudyQueue(prev => [...prev, card])
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1)
                setIsFlipped(false)
                setShowRating(false)
            }, 300)
        } else {
            setPassedCount(prev => prev + 1)
            if (currentIndex === studyQueue.length - 1) {
                completeSession()
            } else {
                setTimeout(() => {
                    goToNext()
                }, 300)
            }
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

    function formatInterval(days: number): string {
        if (days === 0) return '< 1d'
        if (days >= 365) return `${(days / 365).toFixed(1)}a`
        if (days >= 30) return `${(days / 30).toFixed(1)}m`
        return `${days}d`
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (studyQueue.length === 0) {
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
            <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950 z-50 overflow-y-auto">
                <div className="min-h-full flex items-center justify-center p-4">
                    <div className="max-w-lg w-full text-center py-8">
                        {/* Celebration Icon */}
                        <div className="relative mb-8">
                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto shadow-2xl shadow-yellow-500/30 animate-bounce">
                                <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                            </div>
                            <div className="absolute -top-4 -right-4 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center animate-pulse">
                                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
                            Sessão Completa!
                        </h1>
                        <p className="text-lg sm:text-xl text-zinc-300 mb-8">
                            Você está arrasando! 🔥
                        </p>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
                            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                                    <span className="text-2xl sm:text-3xl font-black text-white">{sessionStats.xpEarned}</span>
                                </div>
                                <p className="text-sm sm:text-base text-emerald-300 font-medium">XP Ganhos</p>
                            </div>

                            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                                    <span className="text-2xl sm:text-3xl font-black text-white">{accuracy}%</span>
                                </div>
                                <p className="text-sm sm:text-base text-blue-300 font-medium">Precisão</p>
                            </div>

                            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                                    <span className="text-2xl sm:text-3xl font-black text-white">{sessionStats.cardsStudied}</span>
                                </div>
                                <p className="text-sm sm:text-base text-purple-300 font-medium">Cards Revisados</p>
                            </div>

                            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                                    <span className="text-2xl sm:text-3xl font-black text-white">{formatTime(sessionStats.timeSpent)}</span>
                                </div>
                                <p className="text-sm sm:text-base text-orange-300 font-medium">Tempo</p>
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
                            style={{ width: `${(passedCount / totalToStudy) * 100}%` }}
                        />
                    </div>
                    <p className="text-center text-xs text-zinc-500 mt-1">
                        {passedCount} / {totalToStudy} concluídos
                        {studyQueue.length > totalToStudy && (
                            <span className="text-amber-500 ml-1">({studyQueue.length - currentIndex} restantes)</span>
                        )}
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
            <div className="flex-1 flex items-center justify-center p-4 md:p-6 relative overflow-y-auto min-h-0">
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
                            if (!isFlipped) {
                                setIsFlipped(true)
                                setShowRating(true)
                            } else {
                                setIsFlipped(false)
                            }
                        }}
                        onEdit={() => setEditingCard(currentCard)}
                        accentColor={getAccentColor(currentCard.disciplines?.name)}
                    />
                )}

                <button
                    onClick={() => {
                        if (!showRating) goToNext()
                    }}
                    disabled={currentIndex === studyQueue.length - 1 || showRating}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hidden md:block"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            </div>

            {/* Rating Buttons */}
            {showRating && (
                <div className="p-4 md:p-6 border-t border-white/5 animate-in slide-in-from-bottom duration-300 flex-shrink-0">
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
                            <span className="text-xs opacity-60 text-[10px] font-normal">&lt; 1m</span>
                        </button>

                        <button
                            onClick={() => handleRating('hard')}
                            className="flex-1 py-4 bg-gradient-to-br from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 border-2 border-amber-500/30 hover:border-amber-500/50 text-amber-400 rounded-2xl font-bold transition-all flex flex-col items-center gap-1 group"
                        >
                            <AlertTriangle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span>Difícil</span>
                            <span className="text-xs opacity-60 text-[10px] font-normal">
                                {(() => {
                                    const daysSince = currentCard?.last_reviewed_at ? differenceInDays(new Date(), new Date(currentCard.last_reviewed_at)) : 0
                                    const { s, d, state } = currentCard ? getEffectiveCardState(currentCard) : { s: 0, d: 0, state: 0 }
                                    return formatInterval(calculateNextReview(3, s, d, state, daysSince, requestRetention, fsrsParams).interval)
                                })()}
                            </span>
                        </button>

                        <button
                            onClick={() => handleRating('easy')}
                            className="flex-1 py-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 rounded-2xl font-bold transition-all flex flex-col items-center gap-1 group"
                        >
                            <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span>Fácil</span>
                            <span className="text-xs opacity-60 text-[10px] font-normal">
                                {(() => {
                                    const daysSince = currentCard?.last_reviewed_at ? differenceInDays(new Date(), new Date(currentCard.last_reviewed_at)) : 0
                                    const { s, d, state } = currentCard ? getEffectiveCardState(currentCard) : { s: 0, d: 0, state: 0 }
                                    return formatInterval(calculateNextReview(5, s, d, state, daysSince, requestRetention, fsrsParams).interval)
                                })()}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Keyboard Hints */}
            <div className="text-center pb-2 pt-1 text-xs text-zinc-600 flex-shrink-0 flex items-center justify-center gap-4">
                <span>Espaço: revelar • ←→: navegar • 1,2,3: avaliar • E: editar</span>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
                    title="Configurações FSRS"
                >
                    <Settings2 className="w-3 h-3" />
                </button>
            </div>

            {/* Modals */}
            {editingCard && (
                <QuickEditModal
                    entry={editingCard}
                    onClose={() => setEditingCard(null)}
                    onSave={handleSaveEdit}
                />
            )}

            {showSettings && (
                <FSRSSettingsModal
                    onClose={() => setShowSettings(false)}
                    onSave={(newRetention, newParams) => {
                        setRequestRetention(newRetention)
                        if (newParams) {
                            setFsrsParams(newParams)
                        } else {
                            // Fallback fetch if for some reason params weren't passed (shouldn't happen with new modal)
                            supabase.auth.getUser().then(({ data: { user } }) => {
                                if (user) {
                                    supabase.from('user_settings').select('fsrs_params').eq('user_id', user.id).single()
                                        .then(({ data }) => {
                                            if (data?.fsrs_params) setFsrsParams(data.fsrs_params)
                                        })
                                }
                            })
                        }
                    }}
                    currentRetention={requestRetention}
                />
            )}
        </div>
    )
}
