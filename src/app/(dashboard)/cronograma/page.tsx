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
    GripVertical
} from 'lucide-react'
import Link from 'next/link'
import { format, addDays, isSameDay, startOfWeek, addWeeks, isBefore, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EmptyState } from '@/components/ui'
import type { Discipline, Topic, StudySchedule, ScheduleItem } from '@/types/database'
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
        durationWeeks: 4,
        selectedDays: [] as number[], // 0 = Sun, 1 = Mon...
        startDate: new Date().toISOString().split('T')[0]
    })
    const [generating, setGenerating] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        loadSchedule()
        loadDisciplines()
    }, [])

    async function loadDisciplines() {
        const { data } = await supabase.from('disciplines').select('*').order('name')
        if (data) setDisciplines(data)
    }

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
            const days = prev.selectedDays.includes(dayId)
                ? prev.selectedDays.filter(d => d !== dayId)
                : [...prev.selectedDays, dayId].sort()
            return { ...prev, selectedDays: days }
        })
    }

    async function generateSchedule() {
        if (!config.disciplineId || config.selectedDays.length === 0) return

        setGenerating(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Check for existing schedule to preserve completed items if strictly "recalculating"
            // Actually, the user might want to keep completed items as completed in history?
            // The requirement is: "completed activities are not changed and should not return to the schedule".
            // Implementation: We find which topics were completed in the previous schedule, and EXCLUDE them from the new one.

            let completedTopicIds: number[] = []

            // Check if we are recalculating an existing schedule
            const scheduleIdToRecalculate = schedule?.id || recalculatingScheduleId

            if (scheduleIdToRecalculate) {
                // Fetch completed items from current schedule
                const { data: completedItems } = await supabase
                    .from('schedule_items')
                    .select('topic_id')
                    .eq('schedule_id', String(scheduleIdToRecalculate))
                    .eq('status', 'completed')

                if (completedItems) {
                    completedTopicIds = completedItems.map(i => i.topic_id)
                }

                await supabase.from('study_schedules').delete().eq('id', String(scheduleIdToRecalculate))

                // Clear the ID reset state
                if (recalculatingScheduleId) setRecalculatingScheduleId(null)
            }

            // 2. Create new schedule
            const { data: newSchedule, error: schedError } = await supabase
                .from('study_schedules')
                .insert({
                    user_id: user.id,
                    rotation_discipline_id: Number(config.disciplineId),
                    duration_weeks: config.durationWeeks,
                    start_date: config.startDate
                })
                .select()
                .single()

            if (schedError) throw schedError

            // 3. Fetch topics
            // We need to fetch topics for the discipline.
            // Since topics are linked to subdisciplines, we join: topics -> subdisciplines -> discipline_id
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

            // 4. Distribute topics
            const totalStudyDays = config.durationWeeks * config.selectedDays.length
            const itemsToInsert = []

            let currentDate = new Date(config.startDate)
            let topicIndex = 0

            // Loop through weeks
            for (let week = 0; week < config.durationWeeks; week++) {
                // Determine dates for this week based on selected days
                // Sort selected days to be chronological within the week
                const sortedDays = [...config.selectedDays].sort((a, b) => a - b)

                // Find the dates for these days in the current week relative to startDate
                // Actually simpler: Iterate day by day from start date and check if match
                // Let's do a reliable approach:
                // Find connection between current date and next valid study date

                for (const dayOfWeek of sortedDays) {
                    // Find the date for this dayOfWeek in the current week
                    // Logic: Get start of this week, add 'dayOfWeek' offset?
                    // Better: We iterate through 7 days of the week and pick matches

                    // Simple "Next X Dates" logic
                }
            }

            // SIMPLER ALGORITHM:
            // Generate all valid study dates first
            // Fix: append T12:00:00 to ensure we are in the middle of the day, avoiding timezone shifts
            const validDates: Date[] = []
            let iterDate = new Date(config.startDate + 'T12:00:00')
            let safety = 0

            while (validDates.length < totalStudyDays && safety < 365) {
                if (config.selectedDays.includes(iterDate.getDay())) {
                    validDates.push(new Date(iterDate))
                }
                iterDate = addDays(iterDate, 1)
                safety++
            }

            // Distribute topics across these dates
            // If more topics than days, stack them. If fewer, spread them.

            const topicsPerDay = Math.max(1, Math.ceil(topicsToSchedule.length / validDates.length))

            let currentDayIdx = 0
            for (let i = 0; i < topicsToSchedule.length; i++) {
                if (currentDayIdx >= validDates.length) currentDayIdx = validDates.length - 1 // Fallback to last day

                itemsToInsert.push({
                    schedule_id: newSchedule.id,
                    topic_id: topicsToSchedule[i].id,
                    study_date: format(validDates[currentDayIdx], 'yyyy-MM-dd'),
                    status: 'pending' as const
                })

                // Move to next day if we filled the quota for today
                // But we must ensure all topics are scheduled.
                // Simple distribution: i % validDates.length ? No, that scatters related topics.
                // We want to fill Day 1, then Day 2.

                // Check how many items already assigned to this day
                const itemsOnThisDay = itemsToInsert.filter(item => item.study_date === format(validDates[currentDayIdx], 'yyyy-MM-dd')).length
                if (itemsOnThisDay >= topicsPerDay && currentDayIdx < validDates.length - 1) {
                    currentDayIdx++
                }
            }

            const { error: itemsError } = await supabase
                .from('schedule_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError

            await loadSchedule()
            setStep(1) // Reset wizard visual but currently we show schedule if 'schedule' object exists
        } catch (error) {
            console.error('Error generating:', error)
            alert('Erro ao gerar cronograma. Tente novamente.')
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
                <div className="flex items-center justify-center gap-6 mb-8 overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
                    {disciplines.map(d => {
                        const Icon = iconMap[d.id] || LayoutDashboard
                        const isActive = activeDisciplineId === d.id
                        const hasSchedule = schedules.some(s => s.rotation_discipline_id === d.id)

                        // Color mapping based on discipline ID to match the image/theme
                        // Inactive: Transparent/Dark BG, Colored Border, Colored Icon
                        // Active: Solid BG, Matching Border, Shadow
                        const colorClass =
                            d.id === 1 ? (isActive ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/40' : 'bg-slate-900/50 border-amber-500/50 text-amber-500 hover:border-amber-500 hover:bg-amber-500/10') :
                                d.id === 2 ? (isActive ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/40' : 'bg-slate-900/50 border-blue-500/50 text-blue-500 hover:border-blue-600 hover:bg-blue-600/10') :
                                    d.id === 3 ? (isActive ? 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/40' : 'bg-slate-900/50 border-orange-500/50 text-orange-500 hover:border-orange-500 hover:bg-orange-500/10') :
                                        d.id === 4 ? (isActive ? 'bg-pink-500 border-pink-500 shadow-lg shadow-pink-500/40' : 'bg-slate-900/50 border-pink-500/50 text-pink-500 hover:border-pink-500 hover:bg-pink-500/10') :
                                            (isActive ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-slate-900/50 border-emerald-500/50 text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/10')

                        return (
                            <button
                                key={d.id}
                                onClick={() => setActiveDisciplineId(d.id)}
                                title={d.name} // Tooltip for accessibility since text is removed
                                className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative group ${colorClass} ${isActive ? 'scale-110 ring-2 ring-offset-2 ring-offset-slate-900 ring-transparent' : 'hover:scale-105'}`}
                            >
                                <Icon className={`w-8 h-8 ${isActive ? 'text-white' : ''}`} />
                                {hasSchedule && (
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 bg-green-500 z-10 flex items-center justify-center`} />
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className="max-w-3xl mx-auto space-y-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Novo Cronograma</h1>
                        <p className="text-slate-400">Configure sua rotação para gerarmos um plano de estudos personalizado.</p>
                    </div>

                    {/* Steps Indicator */}
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-400' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step >= 1 ? 'bg-blue-500/20 border-blue-500' : 'border-slate-700'}`}>1</div>
                            Rotação
                        </div>
                        <div className="h-px bg-slate-700 w-12" />
                        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-400' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step >= 2 ? 'bg-blue-500/20 border-blue-500' : 'border-slate-700'}`}>2</div>
                            Configuração
                        </div>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
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
                                                : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                                                }`}
                                        >
                                            <span className="font-medium text-white block mb-1">{d.name}</span>
                                            <span className="text-sm text-slate-400">Selecionar rotação</span>
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
                                {/* Duration */}
                                <div>
                                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        Duração da Rotação
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="1"
                                            max="12"
                                            value={config.durationWeeks}
                                            onChange={(e) => setConfig({ ...config, durationWeeks: Number(e.target.value) })}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-2xl font-bold text-white w-24 text-center">
                                            {config.durationWeeks} <span className="text-sm font-normal text-slate-400">semanas</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Days Selection */}
                                <div>
                                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-blue-400" />
                                        Dias de Estudo
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {weekDays.map(day => (
                                            <button
                                                key={day.id}
                                                onClick={() => toggleDay(day.id)}
                                                className={`w-12 h-12 rounded-xl font-medium transition-all ${config.selectedDays.includes(day.id)
                                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-sm text-slate-500 mt-2">Selecione os dias que você terá disponíveis para estudar.</p>
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
                                        className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white"
                                    />
                                </div>

                                <div className="flex justify-between pt-6 border-t border-slate-700/50">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-6 py-3 text-slate-400 hover:text-white font-medium"
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
            <div className="flex items-center justify-center gap-6 mb-8 overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
                {disciplines.map(d => {
                    const Icon = iconMap[d.id] || LayoutDashboard
                    const isActive = activeDisciplineId === d.id
                    const hasSchedule = schedules.some(s => s.rotation_discipline_id === d.id)

                    // Color mapping based on discipline ID
                    // Inactive: Transparent/Dark BG, Colored Border, Colored Icon
                    // Active: Solid BG, Matching Border, Shadow
                    const colorClass =
                        d.id === 1 ? (isActive ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/40' : 'bg-slate-900/50 border-amber-500/50 text-amber-500 hover:border-amber-500 hover:bg-amber-500/10') :
                            d.id === 2 ? (isActive ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/40' : 'bg-slate-900/50 border-blue-500/50 text-blue-500 hover:border-blue-600 hover:bg-blue-600/10') :
                                d.id === 3 ? (isActive ? 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/40' : 'bg-slate-900/50 border-orange-500/50 text-orange-500 hover:border-orange-500 hover:bg-orange-500/10') :
                                    d.id === 4 ? (isActive ? 'bg-pink-500 border-pink-500 shadow-lg shadow-pink-500/40' : 'bg-slate-900/50 border-pink-500/50 text-pink-500 hover:border-pink-500 hover:bg-pink-500/10') :
                                        (isActive ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-slate-900/50 border-emerald-500/50 text-emerald-500 hover:border-emerald-500 hover:bg-emerald-500/10')

                    return (
                        <button
                            key={d.id}
                            onClick={() => setActiveDisciplineId(d.id)}
                            title={d.name}
                            className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative group ${colorClass} ${isActive ? 'scale-110 ring-2 ring-offset-2 ring-offset-slate-900 ring-transparent' : 'hover:scale-105'}`}
                        >
                            <Icon className={`w-8 h-8 ${isActive ? 'text-white' : ''}`} />
                            {hasSchedule && (
                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 bg-green-500 z-10`} />
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
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(schedule.start_date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}</span>
                        <span>•</span>
                        <span>{schedule.duration_weeks} semanas</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            if (confirm('Deseja recalcular o cronograma? Isso permitirá redefinir a duração e os dias, mantendo a disciplina.')) {
                                // Pre-fill basic config but let user choose days again
                                setConfig({
                                    ...config,
                                    disciplineId: schedule.rotation_discipline_id.toString(),
                                    durationWeeks: schedule.duration_weeks,
                                    startDate: new Date().toISOString().split('T')[0]
                                })
                                setRecalculatingScheduleId(schedule.id)
                                setSchedule(null)
                                setStep(2) // Jump to config step
                            }
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium border border-slate-700 transition-colors flex items-center gap-2"
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
                                    startDate: new Date().toISOString().split('T')[0]
                                })
                                setStep(1)
                            }
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium border border-slate-700 transition-colors"
                    >
                        Novo
                    </button>
                    <div className="w-px h-8 bg-slate-700 mx-1" />
                    <button
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                        onClick={() => setViewMode('timeline')}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                        onClick={() => setViewMode('calendar')}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Progress Card */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Progresso da Rotação</h3>
                    <span className="text-2xl font-bold text-blue-400">{percentage}%</span>
                </div>
                <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="mt-4 flex gap-4 text-sm text-slate-400">
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
                    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-900/30">
                            <button
                                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-bold text-white capitalize">
                                {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
                            </h3>
                            <button
                                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 border-b border-slate-700/50">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="p-2 text-center text-xs font-semibold text-slate-500 uppercase">
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
                                    cells.push(<div key={`empty-${i}`} className="min-h-[100px] bg-slate-900/20 border-r border-b border-slate-700/30" />)
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
                                                className={`min-h-[100px] p-2 border-r border-b border-slate-700/30 transition-colors ${isTodayCheck ? 'bg-blue-500/10' :
                                                    isOverdue ? 'bg-red-500/5' :
                                                        allComplete ? 'bg-green-500/5' : 'hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <div className={`text-sm font-medium mb-1 ${isTodayCheck ? 'text-blue-400' :
                                                    isOverdue ? 'text-red-400' : 'text-slate-400'
                                                    }`}>
                                                    {format(day, 'd')}
                                                </div>
                                                <div className="space-y-1">
                                                    {dayItems.slice(0, 3).map((item, idx) => {
                                                        if (item.type === 'study') {
                                                            return (
                                                                <DraggableItem key={item.data.id} id={item.data.id}>
                                                                    <div
                                                                        className={`text-xs px-1.5 py-0.5 rounded truncate ${item.data.status === 'completed'
                                                                            ? 'bg-green-500/20 text-green-300 line-through'
                                                                            : isOverdue
                                                                                ? 'bg-red-500/20 text-red-300'
                                                                                : 'bg-slate-700 text-slate-300'
                                                                            }`}
                                                                    >
                                                                        {item.data.topics?.name?.slice(0, 12)}...
                                                                    </div>
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
                                                        <div className="text-xs text-slate-500">+{dayItems.length - 3} mais</div>
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
                                            'border-slate-700'
                                        }`}>
                                        {/* Dot */}
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${isToday ? 'bg-blue-500 border-blue-500' :
                                            isDayOverdue ? 'bg-red-900 border-red-500' :
                                                allCompleted ? 'bg-green-500 border-green-500' :
                                                    'bg-slate-900 border-slate-700'
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
                                                                : 'bg-slate-800/30 border-purple-500/40'
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
                                                                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
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
                                                            <div
                                                                onClick={() => toggleItemStatus(studyItem.id, studyItem.status)}
                                                                className={`group p-4 rounded-xl border cursor-pointer transition-all ${studyItem.status === 'completed'
                                                                    ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                                                                    : isOverdue
                                                                        ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                                                                        : 'bg-slate-800/50 border-slate-700/50 hover:border-blue-500/50'
                                                                    }`}
                                                            >
                                                                <div className="flex items-start gap-4">
                                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${studyItem.status === 'completed'
                                                                        ? 'bg-green-500 border-green-500'
                                                                        : isOverdue
                                                                            ? 'border-red-500 text-red-500'
                                                                            : 'border-slate-600 group-hover:border-blue-500'
                                                                        }`}>
                                                                        {studyItem.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                                    </div>
                                                                    <div>
                                                                        <p className={`font-medium transition-colors ${studyItem.status === 'completed'
                                                                            ? 'text-slate-500 line-through'
                                                                            : isOverdue
                                                                                ? 'text-red-400'
                                                                                : 'text-white'
                                                                            }`}>
                                                                            {studyItem.topics?.name}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className={`text-xs px-2 py-0.5 rounded ${isOverdue
                                                                                ? 'bg-red-500/20 text-red-300'
                                                                                : 'bg-slate-700 text-slate-300'
                                                                                }`}>
                                                                                {isOverdue ? 'Atrasado' : 'Tópico'}
                                                                            </span>
                                                                            {studyItem.status !== 'completed' && (
                                                                                <Link
                                                                                    href={`/registrar?disciplineId=${schedule.rotation_discipline_id}&subdisciplineId=${studyItem.topics?.subdiscipline_id}&topicId=${studyItem.topic_id}`}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center gap-1 transition-colors"
                                                                                >
                                                                                    Registrar questões
                                                                                    <ArrowRight className="w-3 h-3" />
                                                                                </Link>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
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

// Draggable Item Wrapper - Entire item is draggable
function DraggableItem({ id, children }: { id: string, children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 1000 : undefined,
    }

    // Apply listeners to entire wrapper so the whole item moves with drag
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 shadow-2xl' : ''}`}
            {...listeners}
            {...attributes}
        >
            {children}
        </div>
    )
}

// Droppable Day Zone
function DroppableDay({ id, children, isOver }: { id: string, children: React.ReactNode, isOver?: boolean }) {
    const { setNodeRef, isOver: dropIsOver } = useDroppable({ id })

    return (
        <div
            ref={setNodeRef}
            className={`transition-all ${dropIsOver ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900 rounded-xl' : ''}`}
        >
            {children}
        </div>
    )
}
