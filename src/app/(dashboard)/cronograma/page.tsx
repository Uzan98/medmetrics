'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Calendar,
    CheckCircle2,
    ChevronRight,
    Clock,
    BookOpen,
    ArrowRight,
    Loader2,
    CalendarDays,
    Settings,
    LayoutDashboard,
    Stethoscope,
    Scissors,
    Baby,
    User,
    Shield,
    Users,
    Grid,
    List,
    ChevronLeft,
    GripVertical,
    Plus,
    Minus
} from 'lucide-react'
import Link from 'next/link'
import { format, addDays, isSameDay, startOfWeek, addWeeks, isBefore, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EmptyState } from '@/components/ui'
import type { Discipline, Topic, StudySchedule, ScheduleItem } from '@/types/database'
import { toast } from 'sonner'
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core'

export default function CronogramaPage() {
    const [loading, setLoading] = useState(true)
    const [schedule, setSchedule] = useState<StudySchedule | null>(null)
    const [schedules, setSchedules] = useState<StudySchedule[]>([])
    const [activeDisciplineId, setActiveDisciplineId] = useState<number | null>(null)
    const [scheduleItems, setScheduleItems] = useState<(ScheduleItem & { topics: Topic })[]>([])
    const [reviews, setReviews] = useState<any[]>([])
    const [recalculatingScheduleId, setRecalculatingScheduleId] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline')
    const [calendarMonth, setCalendarMonth] = useState(new Date())

    // Wizard State
    const [step, setStep] = useState(1)
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [config, setConfig] = useState({
        disciplineId: '',
        durationWeeks: 4, // Will be calculated automatically now
        selectedDays: [] as number[], // 0 = Sun, 1 = Mon...
        dailyCapacities: {} as Record<number, number>, // Day ID -> Capacity
        startDate: new Date().toISOString().split('T')[0]
    })
    const [generating, setGenerating] = useState(false)
    const [totalTopics, setTotalTopics] = useState<number>(0)

    const supabase = createClient()

    useEffect(() => {
        loadSchedule()
        loadDisciplines()
    }, [])

    async function loadDisciplines() {
        const { data } = await supabase.from('disciplines').select('*').order('name')
        if (data) setDisciplines(data)
    }

    // Load topic count when discipline changes in wizard
    useEffect(() => {
        async function fetchTopicCount() {
            if (!config.disciplineId) return

            try {
                // Get subdisciplines first
                const { data: subs } = await supabase
                    .from('subdisciplines')
                    .select('id')
                    .eq('discipline_id', Number(config.disciplineId))

                if (!subs || subs.length === 0) {
                    setTotalTopics(0)
                    return
                }

                const subIds = subs.map(s => s.id)
                const { count } = await supabase
                    .from('topics')
                    .select('id', { count: 'exact', head: true })
                    .in('subdiscipline_id', subIds)

                setTotalTopics(count || 0)
            } catch (err) {
                console.error('Error fetching topic count:', err)
            }
        }
        fetchTopicCount()
    }, [config.disciplineId])

    async function loadSchedule() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Load ALL schedules for the user
            const { data: allSchedules } = await supabase
                .from('study_schedules')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (allSchedules) {
                setSchedules(allSchedules)

                // Determine which schedule to show
                // If activeDisciplineId is set, find matching schedule
                // Else take the most recent one
                let currentSchedule = null

                if (activeDisciplineId) {
                    currentSchedule = allSchedules.find(s => s.rotation_discipline_id === activeDisciplineId)
                } else if (allSchedules.length > 0) {
                    currentSchedule = allSchedules[0]
                    setActiveDisciplineId(currentSchedule.rotation_discipline_id)
                }

                setSchedule(currentSchedule || null)

                if (currentSchedule) {
                    // Update config for consistency
                    setConfig(prev => ({
                        ...prev,
                        disciplineId: currentSchedule.rotation_discipline_id.toString(),
                        durationWeeks: currentSchedule.duration_weeks,
                        startDate: currentSchedule.start_date
                    }))

                    // Load items
                    const { data: items } = await supabase
                        .from('schedule_items')
                        .select('*, topics(*)')
                        .eq('schedule_id', currentSchedule.id)
                        .order('study_date', { ascending: true })

                    if (items) setScheduleItems(items as any)

                    // Load reviews
                    const { data: userReviews } = await supabase
                        .from('scheduled_reviews')
                        .select('*, disciplines(name), subdisciplines(name)')
                        .eq('user_id', user.id)
                        .gte('scheduled_date', currentSchedule.start_date)

                    if (userReviews) setReviews(userReviews)
                } else {
                    // No schedule found for context
                    setScheduleItems([])
                    setReviews([])
                    // Ensure wizard starts with selected discipline
                    if (activeDisciplineId) {
                        setConfig(prev => ({ ...prev, disciplineId: activeDisciplineId.toString() }))
                    }
                }
            }
        } catch (error) {
            console.error('Error loading schedule:', error)
        } finally {
            setLoading(false)
        }
    }

    // Effect to reload when activeDisciplineId changes
    useEffect(() => {
        if (activeDisciplineId) {
            // Find in already loaded schedules first to avoid flicker, or strictly reload?
            // "loadSchedule" effectively re-runs the selection logic.
            // But we might want to avoid re-fetching if we have the data.
            // However, we need to fetch items for the specific schedule.
            loadSchedule()
        }
    }, [activeDisciplineId])

    const weekDays = [
        { id: 0, label: 'D', name: 'Domingo' },
        { id: 1, label: 'S', name: 'Segunda' },
        { id: 2, label: 'T', name: 'Terça' },
        { id: 3, label: 'Q', name: 'Quarta' },
        { id: 4, label: 'Q', name: 'Quinta' },
        { id: 5, label: 'S', name: 'Sexta' },
        { id: 6, label: 'S', name: 'Sábado' },
    ]

    function toggleDay(dayId: number) {
        setConfig(prev => {
            const isSelected = prev.selectedDays.includes(dayId)
            let newDays = isSelected
                ? prev.selectedDays.filter(d => d !== dayId)
                : [...prev.selectedDays, dayId].sort()

            // Manage capacities
            const newCapacities = { ...prev.dailyCapacities }
            if (!isSelected) {
                // Default capacity of 2 when selecting a new day
                newCapacities[dayId] = 2
            } else {
                // Optional: keep capacity in memory or delete? Let's keep it clean
                delete newCapacities[dayId]
            }

            return { ...prev, selectedDays: newDays, dailyCapacities: newCapacities }
        })
    }

    function updateDayCapacity(dayId: number, delta: number) {
        setConfig(prev => {
            const current = prev.dailyCapacities[dayId] || 2
            const newCap = Math.max(1, Math.min(10, current + delta))
            return {
                ...prev,
                dailyCapacities: { ...prev.dailyCapacities, [dayId]: newCap }
            }
        })
    }

    // Calculate estimated duration based on capacity
    const estimatedWeeks = (() => {
        if (config.selectedDays.length === 0 || totalTopics === 0) return 0

        let weeklyCapacity = 0
        config.selectedDays.forEach(day => {
            weeklyCapacity += (config.dailyCapacities[day] || 2)
        })

        if (weeklyCapacity === 0) return 0
        return Math.ceil(totalTopics / weeklyCapacity)
    })()

    async function generateSchedule() {
        if (!config.disciplineId || config.selectedDays.length === 0) return

        setGenerating(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Check for existing schedule to preserve completed items
            let completedTopicIds: number[] = []
            const scheduleIdToRecalculate = schedule?.id || recalculatingScheduleId

            if (scheduleIdToRecalculate) {
                const { data: completedItems } = await supabase
                    .from('schedule_items')
                    .select('topic_id')
                    .eq('schedule_id', String(scheduleIdToRecalculate))
                    .eq('status', 'completed')

                if (completedItems) {
                    completedTopicIds = completedItems.map(i => i.topic_id)
                }

                await supabase.from('study_schedules').delete().eq('id', String(scheduleIdToRecalculate))
                if (recalculatingScheduleId) setRecalculatingScheduleId(null)
            }

            // 2. Fetch topics
            const { data: subdisciplines } = await supabase
                .from('subdisciplines')
                .select('id')
                .eq('discipline_id', Number(config.disciplineId))

            if (!subdisciplines || subdisciplines.length === 0) throw new Error('No subdisciplines found')

            const subIds = subdisciplines.map(s => s.id)
            const { data: topics } = await supabase
                .from('topics')
                .select('id')
                .in('subdiscipline_id', subIds)

            if (!topics || topics.length === 0) throw new Error('No topics found')

            // Filter out completed topics
            const topicsToSchedule = topics.filter(t => !completedTopicIds.includes(t.id))

            // 3. Prepare schedule distribution
            // We don't create the schedule record yet because we need to know the final duration
            const itemsToInsert = []
            let iterDate = new Date(config.startDate + 'T12:00:00')
            let safety = 0
            let topicsAssigned = 0

            // Generate assignments until all topics are assigned
            while (topicsAssigned < topicsToSchedule.length && safety < 1000) {
                const dayOfWeek = iterDate.getDay() // 0-6

                if (config.selectedDays.includes(dayOfWeek)) {
                    // It's a study day. Get capacity.
                    const capacity = config.dailyCapacities[dayOfWeek] || 2

                    // Assign up to 'capacity' topics
                    for (let i = 0; i < capacity; i++) {
                        if (topicsAssigned >= topicsToSchedule.length) break

                        itemsToInsert.push({
                            topic_id: topicsToSchedule[topicsAssigned].id,
                            study_date: format(iterDate, 'yyyy-MM-dd'),
                            status: 'pending' as const
                        })
                        topicsAssigned++
                    }
                }

                // Move to next day if we still have topics (or just move always)
                if (topicsAssigned < topicsToSchedule.length) {
                    iterDate = addDays(iterDate, 1)
                }
                safety++
            }

            // Calculate final duration in weeks
            // Start Date to Last Date
            const endDate = itemsToInsert.length > 0 ? new Date(itemsToInsert[itemsToInsert.length - 1].study_date) : new Date(config.startDate)
            const startDate = new Date(config.startDate)
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 inclusive
            const calculatedWeeks = Math.max(1, Math.ceil(diffDays / 7))


            // 4. Create new schedule with calculated duration
            const { data: newSchedule, error: schedError } = await supabase
                .from('study_schedules')
                .insert({
                    user_id: user.id,
                    rotation_discipline_id: Number(config.disciplineId),
                    duration_weeks: calculatedWeeks,
                    start_date: config.startDate
                })
                .select()
                .single()

            if (schedError) throw schedError

            // 5. Insert items with the new schedule ID
            const itemsWithId = itemsToInsert.map(item => ({
                ...item,
                schedule_id: newSchedule.id
            }))

            const { error: itemsError } = await supabase
                .from('schedule_items')
                .insert(itemsWithId)

            if (itemsError) throw itemsError

            await loadSchedule()
            setStep(1)
        } catch (error) {
            console.error('Error generating:', error)
            toast.error('Erro ao gerar cronograma. Tente novamente.')
        } finally {
            setGenerating(false)
        }
    }

    async function toggleItemStatus(itemId: string, currentStatus: string) {
        // Optimistic update
        setScheduleItems(prev => prev.map(item =>
            item.id === itemId
                ? { ...item, status: currentStatus === 'completed' ? 'pending' : 'completed' }
                : item
        ))

        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
        await supabase
            .from('schedule_items')
            .update({ status: newStatus })
            .eq('id', itemId)
    }

    // Drag and Drop
    const [activeId, setActiveId] = useState<string | null>(null)

    async function updateItemDate(itemId: string, newDate: string) {
        // Optimistic update
        setScheduleItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, study_date: newDate } : item
        ))
        // Database update
        await supabase
            .from('schedule_items')
            .update({ study_date: newDate })
            .eq('id', itemId)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        setActiveId(null)

        if (over && active.id !== over.id) {
            const itemId = active.id as string
            const newDate = over.id as string
            // Check if 'over' is a date (droppable day)
            if (newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                updateItemDate(itemId, newDate)
            }
        }
    }

    const activeItem = activeId ? scheduleItems.find(item => item.id === activeId) : null

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        )
    }

    const iconMap: Record<number, any> = {
        1: Stethoscope,
        2: Scissors,
        3: Baby,
        4: User,
        5: Shield
    }

    // Wizard View
    if (!schedule) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Discipline Header */}
                <div className="flex items-center justify-center gap-6 mb-8 overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700">
                    {disciplines.map(d => {
                        const Icon = iconMap[d.id] || LayoutDashboard
                        const isActive = activeDisciplineId === d.id
                        const hasSchedule = schedules.some(s => s.rotation_discipline_id === d.id)

                        // Color mapping based on discipline ID to match the image/theme
                        // Inactive: Transparent/Dark BG, Colored Border, Colored Icon
                        // Active: Solid BG, Matching Border, Shadow
                        const colorClass =
                            d.id === 1 ? (isActive ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/40' : 'bg-zinc-900/50 border-amber-500/50 text-amber-500 hover:border-amber-500 hover:bg-amber-500/10') :
                                d.id === 2 ? (isActive ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/40' : 'bg-zinc-900/50 border-blue-500/50 text-blue-500 hover:border-blue-600 hover:bg-blue-600/10') :
                                    d.id === 3 ? (isActive ? 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/40' : 'bg-zinc-900/50 border-orange-500/50 text-orange-500 hover:border-orange-500 hover:bg-orange-500/10') :
                                        d.id === 4 ? (isActive ? 'bg-pink-500 border-pink-500 shadow-lg shadow-pink-500/40' : 'bg-zinc-900/50 border-pink-500/50 text-pink-500 hover:border-pink-500 hover:bg-pink-500/10') :
                                            (isActive ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-zinc-900/50 border-emerald-500/50 text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/10')

                        return (
                            <button
                                key={d.id}
                                onClick={() => setActiveDisciplineId(d.id)}
                                title={d.name} // Tooltip for accessibility since text is removed
                                className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative group ${colorClass} ${isActive ? 'scale-110 ring-2 ring-offset-2 ring-offset-zinc-900 ring-transparent' : 'hover:scale-105'}`}
                            >
                                <Icon className={`w-8 h-8 ${isActive ? 'text-white' : ''}`} />
                                {hasSchedule && (
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-zinc-900 bg-green-500 z-10 flex items-center justify-center`} />
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className="max-w-3xl mx-auto space-y-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Novo Cronograma</h1>
                        <p className="text-zinc-400">Configure sua rotação para gerarmos um plano de estudos personalizado.</p>
                    </div>

                    {/* Steps Indicator */}
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-400' : 'text-zinc-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step >= 1 ? 'bg-blue-500/20 border-blue-500' : 'border-zinc-700'}`}>1</div>
                            Rotação
                        </div>
                        <div className="h-px bg-zinc-700 w-12" />
                        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-400' : 'text-zinc-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step >= 2 ? 'bg-blue-500/20 border-blue-500' : 'border-zinc-700'}`}>2</div>
                            Configuração
                        </div>
                    </div>

                    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-8">
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Qual rotação você vai iniciar?</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {disciplines.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => setConfig({ ...config, disciplineId: d.id.toString() })}
                                            className={`p-4 rounded-xl border text-left transition-all ${config.disciplineId === d.id.toString()
                                                ? 'bg-blue-500/20 border-blue-500 ring-1 ring-blue-500'
                                                : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-500'
                                                }`}
                                        >
                                            <span className="font-medium text-white block mb-1">{d.name}</span>
                                            <span className="text-sm text-zinc-400">Selecionar rotação</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!config.disciplineId}
                                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        Próximo passo
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-8">
                                {/* Estimation */}
                                <div>
                                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        Estimativa de Duração
                                    </h3>
                                    <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-zinc-400 text-sm mb-1">Com base na sua disponibilidade:</p>
                                            <p className="text-2xl font-bold text-white">
                                                {estimatedWeeks > 0 ? estimatedWeeks : '-'} <span className="text-sm font-normal text-zinc-400">semanas</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-zinc-400 text-sm mb-1">Total de tópicos:</p>
                                            <p className="text-lg font-semibold text-white">{totalTopics}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Days Selection */}
                                <div>
                                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-blue-400" />
                                        Disponibilidade Semanal
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {weekDays.map(day => (
                                                <button
                                                    key={day.id}
                                                    onClick={() => toggleDay(day.id)}
                                                    className={`w-12 h-12 rounded-xl font-medium transition-all ${config.selectedDays.includes(day.id)
                                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-700'
                                                        }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Capacity Controls for Selected Days */}
                                        {config.selectedDays.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in pt-2">
                                                {config.selectedDays.sort((a, b) => a - b).map(dayId => {
                                                    const day = weekDays.find(d => d.id === dayId)
                                                    const capacity = config.dailyCapacities[dayId] || 2

                                                    return (
                                                        <div key={dayId} className="bg-zinc-900/30 border border-zinc-700/50 rounded-xl p-3 flex items-center justify-between">
                                                            <span className="text-sm text-zinc-300 font-medium">{day?.name}</span>
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => updateDayCapacity(dayId, -1)}
                                                                    className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className="w-4 text-center text-white font-bold">{capacity}</span>
                                                                <button
                                                                    onClick={() => updateDayCapacity(dayId, 1)}
                                                                    className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        <p className="text-sm text-zinc-500">Selecione os dias e defina quantos assuntos estudar em cada um.</p>
                                    </div>
                                </div>

                                {/* Start Date */}
                                <div>
                                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                        Data de Início
                                    </h3>
                                    <input
                                        type="date"
                                        value={config.startDate}
                                        onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                                        className="bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2 text-white"
                                    />
                                </div>

                                <div className="flex justify-between pt-6 border-t border-zinc-700/50">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-6 py-3 text-zinc-400 hover:text-white font-medium"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        onClick={generateSchedule}
                                        disabled={config.selectedDays.length === 0 || generating}
                                        className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/20"
                                    >
                                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                                        Gerar Cronograma
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Timeline Data Preparation
    type TimelineItem =
        | { type: 'study', data: ScheduleItem & { topics: Topic }, date: string }
        | { type: 'review', data: any, date: string }

    const timelineData: { [date: string]: TimelineItem[] } = {}

    // Add Schedule Items
    scheduleItems.forEach(item => {
        if (!timelineData[item.study_date]) timelineData[item.study_date] = []
        timelineData[item.study_date].push({ type: 'study', data: item, date: item.study_date })
    })

    // Add Reviews
    reviews.forEach(review => {
        if (!timelineData[review.scheduled_date]) timelineData[review.scheduled_date] = []
        timelineData[review.scheduled_date].push({ type: 'review', data: review, date: review.scheduled_date })
    })

    // Calculate percentage including reviews? Or just study? Let's keep study progress separate for now or maybe combine.
    // The user asked to "see reviews in schedule", not necessarily count towards the rotation progress.
    // So I will keep the progress bar focused on the Schedule Items (Topics).

    const percentage = scheduleItems.length > 0
        ? Math.round((scheduleItems.filter(i => i.status === 'completed').length / scheduleItems.length) * 100)
        : 0

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Discipline Header */}
            <div className="flex items-center justify-center gap-6 mb-8 overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700">
                {disciplines.map(d => {
                    const Icon = iconMap[d.id] || LayoutDashboard
                    const isActive = activeDisciplineId === d.id
                    const hasSchedule = schedules.some(s => s.rotation_discipline_id === d.id)

                    // Color mapping based on discipline ID
                    // Inactive: Transparent/Dark BG, Colored Border, Colored Icon
                    // Active: Solid BG, Matching Border, Shadow
                    const colorClass =
                        d.id === 1 ? (isActive ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/40' : 'bg-zinc-900/50 border-amber-500/50 text-amber-500 hover:border-amber-500 hover:bg-amber-500/10') :
                            d.id === 2 ? (isActive ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/40' : 'bg-zinc-900/50 border-blue-500/50 text-blue-500 hover:border-blue-600 hover:bg-blue-600/10') :
                                d.id === 3 ? (isActive ? 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/40' : 'bg-zinc-900/50 border-orange-500/50 text-orange-500 hover:border-orange-500 hover:bg-orange-500/10') :
                                    d.id === 4 ? (isActive ? 'bg-pink-500 border-pink-500 shadow-lg shadow-pink-500/40' : 'bg-zinc-900/50 border-pink-500/50 text-pink-500 hover:border-pink-500 hover:bg-pink-500/10') :
                                        (isActive ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-zinc-900/50 border-emerald-500/50 text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/10')

                    return (
                        <button
                            key={d.id}
                            onClick={() => setActiveDisciplineId(d.id)}
                            title={d.name}
                            className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative group ${colorClass} ${isActive ? 'scale-110 ring-2 ring-offset-2 ring-offset-zinc-900 ring-transparent' : 'hover:scale-105'}`}
                        >
                            <Icon className={`w-8 h-8 ${isActive ? 'text-white' : ''}`} />
                            {hasSchedule && (
                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-zinc-900 bg-green-500 z-10`} />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                        Cronograma: {disciplines.find(d => d.id === schedule.rotation_discipline_id)?.name}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(schedule.start_date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}</span>
                        <span>•</span>
                        <span>{schedule.duration_weeks} semanas</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            if (confirm('Deseja recalcular o cronograma? Isso permitirá redefinir a duração e os dias, mantendo a disciplina.')) {
                                // Pre-fill basic config but let user choose days again
                                setConfig({
                                    ...config,
                                    disciplineId: schedule.rotation_discipline_id.toString(),
                                    durationWeeks: schedule.duration_weeks,
                                    dailyCapacities: {},
                                    startDate: new Date().toISOString().split('T')[0]
                                })
                                setRecalculatingScheduleId(schedule.id)
                                setSchedule(null)
                                setStep(2) // Jump to config step
                            }
                        }}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium border border-zinc-700 transition-colors flex items-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        Recalcular
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Tem certeza que deseja criar um novo cronograma do zero? O atual será perdido.')) {
                                setSchedule(null)
                                setConfig({
                                    disciplineId: '',
                                    durationWeeks: 4,
                                    selectedDays: [],
                                    dailyCapacities: {},
                                    startDate: new Date().toISOString().split('T')[0]
                                })
                                setStep(1)
                            }
                        }}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium border border-zinc-700 transition-colors"
                    >
                        Novo
                    </button>
                    <div className="w-px h-8 bg-zinc-700 mx-1" />
                    <button
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'}`}
                        onClick={() => setViewMode('timeline')}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'}`}
                        onClick={() => setViewMode('calendar')}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Progress Card */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Progresso da Rotação</h3>
                    <span className="text-2xl font-bold text-blue-400">{percentage}%</span>
                </div>
                <div className="h-4 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="mt-4 flex gap-4 text-sm text-zinc-400">
                    <div>
                        <span className="text-white font-medium">{scheduleItems.filter(i => i.status === 'completed').length}</span> concluídos
                    </div>
                    <div>
                        <span className="text-white font-medium">{scheduleItems.length}</span> total
                    </div>
                </div>
            </div>

            {/* Calendar View */}
            {viewMode === 'calendar' && (
                <DndContext collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
                    <div className="bg-zinc-800/50 rounded-2xl border border-zinc-700/50 overflow-hidden">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-700/50 bg-zinc-900/30">
                            <button
                                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-bold text-white capitalize">
                                {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
                            </h3>
                            <button
                                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 border-b border-zinc-700/50">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="p-2 text-center text-xs font-semibold text-zinc-500 uppercase">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7">
                            {(() => {
                                const monthStart = startOfMonth(calendarMonth)
                                const monthEnd = endOfMonth(calendarMonth)
                                const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
                                const startDay = getDay(monthStart) // 0-6
                                const cells: React.ReactNode[] = []

                                // Empty cells for days before month starts
                                for (let i = 0; i < startDay; i++) {
                                    cells.push(<div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[100px] bg-zinc-900/20 border-r border-b border-zinc-700/30" />)
                                }

                                // Days of the month
                                days.forEach(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd')
                                    const dayItems = timelineData[dateStr] || []
                                    const isTodayCheck = isSameDay(day, new Date())
                                    const isPastCheck = isBefore(day, startOfToday())
                                    const hasStudy = dayItems.some(i => i.type === 'study')
                                    const hasReview = dayItems.some(i => i.type === 'review')
                                    const allComplete = dayItems.length > 0 && dayItems.every(i =>
                                        i.type === 'study' ? i.data.status === 'completed' : i.data.completed
                                    )
                                    const hasPending = dayItems.some(i => i.type === 'study' && i.data.status === 'pending')
                                    const isOverdue = isPastCheck && hasPending

                                    cells.push(
                                        <DroppableDay key={dateStr} id={dateStr}>
                                            <div
                                                className={`min-h-[60px] sm:min-h-[100px] p-2 border-r border-b border-zinc-700/30 transition-colors ${isTodayCheck ? 'bg-blue-500/10' :
                                                    isOverdue ? 'bg-red-500/5' :
                                                        allComplete ? 'bg-green-500/5' : 'hover:bg-zinc-800/50'
                                                    }`}
                                            >
                                                <div className={`text-sm font-medium mb-1 ${isTodayCheck ? 'text-blue-400' :
                                                    isOverdue ? 'text-red-400' : 'text-zinc-400'
                                                    }`}>
                                                    {format(day, 'd')}
                                                </div>
                                                <div className="space-y-1">
                                                    {dayItems.slice(0, 3).map((item, idx) => {
                                                        if (item.type === 'study') {
                                                            return (
                                                                <DraggableItem key={item.data.id} id={item.data.id}>
                                                                    {({ listeners, attributes, isDragging }) => (
                                                                        <div
                                                                            {...listeners}
                                                                            {...attributes}
                                                                            className={`text-xs px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing ${item.data.status === 'completed'
                                                                                ? 'bg-green-500/20 text-green-300 line-through'
                                                                                : isOverdue
                                                                                    ? 'bg-red-500/20 text-red-300'
                                                                                    : 'bg-zinc-700 text-zinc-300'
                                                                                } ${isDragging ? 'opacity-50 z-50' : ''}`}
                                                                        >
                                                                            {item.data.topics?.name?.slice(0, 12)}...
                                                                        </div>
                                                                    )}
                                                                </DraggableItem>
                                                            )
                                                        }
                                                        return (
                                                            <div
                                                                key={`review-${idx}`}
                                                                className="text-xs px-1.5 py-0.5 rounded truncate bg-purple-500/20 text-purple-300"
                                                            >
                                                                Revisão
                                                            </div>
                                                        )
                                                    })}
                                                    {dayItems.length > 3 && (
                                                        <div className="text-xs text-zinc-500">+{dayItems.length - 3} mais</div>
                                                    )}
                                                </div>
                                            </div>
                                        </DroppableDay>
                                    )
                                })

                                return cells
                            })()}
                        </div>
                    </div>
                </DndContext>
            )}

            {/* Timeline View */}
            {viewMode === 'timeline' && (
                <DndContext collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
                    <div className="space-y-6">
                        {Object.entries(timelineData).sort().map(([date, items]) => {
                            const isToday = isSameDay(new Date(), new Date(date + 'T12:00:00'))
                            const isPast = isBefore(new Date(date + 'T12:00:00'), startOfToday())

                            const anyPending = items.some(i => i.type === 'study' && i.data.status === 'pending')
                            const isDayOverdue = isPast && anyPending

                            const allCompleted = items.every(i =>
                                i.type === 'study' ? i.data.status === 'completed' : i.data.completed
                            )

                            return (
                                <DroppableDay key={date} id={date}>
                                    <div className={`relative pl-8 border-l-2 ${isToday ? 'border-blue-500' :
                                        isDayOverdue ? 'border-red-500/50' :
                                            'border-zinc-700'
                                        }`}>
                                        {/* Dot */}
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${isToday ? 'bg-blue-500 border-blue-500' :
                                            isDayOverdue ? 'bg-red-900 border-red-500' :
                                                allCompleted ? 'bg-green-500 border-green-500' :
                                                    'bg-zinc-900 border-zinc-700'
                                            }`} />

                                        <div className="mb-2">
                                            <h3 className={`font-semibold ${isToday ? 'text-blue-400' :
                                                isDayOverdue ? 'text-red-400' :
                                                    'text-white'
                                                }`}>
                                                {format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                            </h3>
                                        </div>

                                        <div className="space-y-3">
                                            {items.map((item, idx) => {
                                                if (item.type === 'review') {
                                                    // Review Item (not draggable)
                                                    const review = item.data
                                                    return (
                                                        <div
                                                            key={`review-${review.id}`}
                                                            className={`p-4 rounded-xl border border-dashed transition-all ${review.completed
                                                                ? 'bg-purple-500/5 border-purple-500/20'
                                                                : 'bg-zinc-800/30 border-purple-500/40'
                                                                }`}
                                                        >
                                                            <div className="flex items-start gap-4">
                                                                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                                                    <CalendarDays className="w-3 h-3 text-purple-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-purple-200">
                                                                        Revisão: {review.subdisciplines?.name || review.disciplines?.name}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/20">
                                                                            {review.review_type === '1d' ? '1 dia' : review.review_type === '7d' ? '7 dias' : '30 dias'}
                                                                        </span>
                                                                        <Link
                                                                            href="/revisoes"
                                                                            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                                                                        >
                                                                            Ir para Revisões <ArrowRight className="w-3 h-3" />
                                                                        </Link>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                } else {
                                                    const studyItem = item.data
                                                    const isOverdue = item.type === 'study' &&
                                                        item.data.status === 'pending' &&
                                                        isBefore(new Date(date + 'T12:00:00'), startOfToday())

                                                    return (
                                                        <DraggableItem key={studyItem.id} id={studyItem.id}>
                                                            {({ listeners, attributes, isDragging }) => (
                                                                <div
                                                                    onClick={() => toggleItemStatus(studyItem.id, studyItem.status)}
                                                                    className={`group p-3 rounded-xl border relative transition-all ${studyItem.status === 'completed'
                                                                        ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                                                                        : isOverdue
                                                                            ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                                                                            : 'bg-zinc-800/50 border-zinc-700/50 hover:border-blue-500/50'
                                                                        } ${isDragging ? 'opacity-50 ring-2 ring-blue-500 z-50' : ''}`}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        {/* Drag Handle */}
                                                                        <div
                                                                            {...listeners}
                                                                            {...attributes}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="mt-0.5 p-1 -ml-1 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing rounded"
                                                                        >
                                                                            <GripVertical className="w-4 h-4" />
                                                                        </div>

                                                                        {/* Check Box */}
                                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5 cursor-pointer ${studyItem.status === 'completed'
                                                                            ? 'bg-green-500 border-green-500'
                                                                            : isOverdue
                                                                                ? 'border-red-500 text-red-500'
                                                                                : 'border-zinc-600 group-hover:border-blue-500'
                                                                            }`}>
                                                                            {studyItem.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                                        </div>

                                                                        {/* Content */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`font-medium transition-colors text-sm break-words ${studyItem.status === 'completed'
                                                                                ? 'text-zinc-500 line-through'
                                                                                : isOverdue
                                                                                    ? 'text-red-400'
                                                                                    : 'text-white'
                                                                                }`}>
                                                                                {studyItem.topics?.name}
                                                                            </p>
                                                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${isOverdue
                                                                                    ? 'bg-red-500/20 text-red-300'
                                                                                    : 'bg-zinc-700 text-zinc-400'
                                                                                    }`}>
                                                                                    {isOverdue ? 'Atrasado' : 'Tópico'}
                                                                                </span>
                                                                                {studyItem.status !== 'completed' && (
                                                                                    <Link
                                                                                        href={`/registrar?disciplineId=${schedule.rotation_discipline_id}&subdisciplineId=${studyItem.topics?.subdiscipline_id}&topicId=${studyItem.topic_id}`}
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center gap-1 transition-colors ml-auto"
                                                                                    >
                                                                                        Registrar
                                                                                        <ArrowRight className="w-3 h-3" />
                                                                                    </Link>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </DraggableItem>
                                                    )
                                                }
                                            })}
                                        </div>
                                    </div>
                                </DroppableDay>
                            )
                        })}
                    </div>
                </DndContext>
            )}
        </div>
    )
}

// Draggable Item Wrapper
function DraggableItem({ id, children }: { id: string, children: (props: { listeners: any, attributes: any, isDragging: boolean }) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 20 : undefined,
    }

    return (
        <div ref={setNodeRef} style={style}>
            {children({ listeners, attributes, isDragging })}
        </div>
    )
}

// Droppable Day Zone
function DroppableDay({ id, children, isOver }: { id: string, children: React.ReactNode, isOver?: boolean }) {
    const { setNodeRef, isOver: dropIsOver } = useDroppable({ id })

    return (
        <div
            ref={setNodeRef}
            className={`transition-all ${dropIsOver ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900 rounded-xl' : ''}`}
        >
            {children}
        </div>
    )
}
