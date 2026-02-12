'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Appointment } from '@/types/database'
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Clock,
    MapPin,
    Check,
    Trash2,
    Edit3,
    GraduationCap,
    Stethoscope,
    FileText,
    BookOpen,
    User,
    Calendar as CalendarIcon,
    MoreHorizontal
} from 'lucide-react'
import { toast } from 'sonner'

// Category config
const CATEGORIES = {
    aula: { label: 'Aula', color: 'blue', emoji: '📚' },
    plantao: { label: 'Plantão', color: 'emerald', emoji: '🏥' },
    prova: { label: 'Prova', color: 'red', emoji: '📝' },
    estudo: { label: 'Estudo', color: 'purple', emoji: '🎯' },
    pessoal: { label: 'Pessoal', color: 'orange', emoji: '👤' },
    outro: { label: 'Outro', color: 'slate', emoji: '📌' },
} as const

type CategoryKey = keyof typeof CATEGORIES

const CATEGORY_COLORS: Record<CategoryKey, { bg: string; border: string; text: string; dot: string }> = {
    aula: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400' },
    plantao: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    prova: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' },
    estudo: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400' },
    pessoal: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
    outro: { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400', dot: 'bg-slate-400' },
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatTimeDisplay(time: string | null): string {
    if (!time) return ''
    return time.slice(0, 5)
}

export default function AgendaPage() {
    const supabase = createClient()

    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(new Date())

    // Data
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [monthDots, setMonthDots] = useState<Record<string, CategoryKey[]>>({})
    const [loading, setLoading] = useState(true)

    // Modal
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: formatDate(new Date()),
        start_time: '',
        end_time: '',
        category: 'outro' as CategoryKey,
    })

    // Load appointments for selected date
    const loadAppointments = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const dateStr = formatDate(selectedDate)
            const { data } = await supabase
                .from('appointments')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .order('start_time', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true })

            setAppointments(data || [])
        } catch (error) {
            console.error('Error loading appointments:', error)
        } finally {
            setLoading(false)
        }
    }, [selectedDate, supabase])

    // Load dots for month calendar
    const loadMonthDots = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const year = currentMonth.getFullYear()
            const month = currentMonth.getMonth()
            const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`

            const { data } = await supabase
                .from('appointments')
                .select('date, category')
                .eq('user_id', user.id)
                .gte('date', firstDay)
                .lte('date', lastDay)

            const dots: Record<string, CategoryKey[]> = {}
            data?.forEach((item) => {
                if (!dots[item.date]) dots[item.date] = []
                if (!dots[item.date].includes(item.category as CategoryKey)) {
                    dots[item.date].push(item.category as CategoryKey)
                }
            })
            setMonthDots(dots)
        } catch (error) {
            console.error('Error loading month dots:', error)
        }
    }, [currentMonth, supabase])

    useEffect(() => {
        loadAppointments()
    }, [loadAppointments])

    useEffect(() => {
        loadMonthDots()
    }, [loadMonthDots])

    // Calendar helpers
    function getCalendarDays() {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const firstDayOfMonth = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const daysInPrevMonth = new Date(year, month, 0).getDate()

        const days: { date: Date; isCurrentMonth: boolean }[] = []

        // Previous month days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, daysInPrevMonth - i),
                isCurrentMonth: false,
            })
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true,
            })
        }

        // Next month days to fill grid
        const remaining = 42 - days.length
        for (let i = 1; i <= remaining; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false,
            })
        }

        return days
    }

    function prevMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    function nextMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    function goToToday() {
        const today = new Date()
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
        setSelectedDate(today)
    }

    function isToday(date: Date) {
        const today = new Date()
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
    }

    function isSelected(date: Date) {
        return date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
    }

    // CRUD
    function openNewAppointment() {
        setEditingId(null)
        setFormData({
            title: '',
            description: '',
            date: formatDate(selectedDate),
            start_time: '',
            end_time: '',
            category: 'outro',
        })
        setShowModal(true)
    }

    function openEditAppointment(apt: Appointment) {
        setEditingId(apt.id)
        setFormData({
            title: apt.title,
            description: apt.description || '',
            date: apt.date,
            start_time: apt.start_time ? apt.start_time.slice(0, 5) : '',
            end_time: apt.end_time ? apt.end_time.slice(0, 5) : '',
            category: apt.category,
        })
        setShowModal(true)
    }

    async function saveAppointment() {
        if (!formData.title.trim()) {
            toast.error('Título é obrigatório')
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const payload = {
                user_id: user.id,
                title: formData.title.trim(),
                description: formData.description.trim() || null,
                date: formData.date,
                start_time: formData.start_time || null,
                end_time: formData.end_time || null,
                category: formData.category,
            }

            if (editingId) {
                const { error } = await supabase
                    .from('appointments')
                    .update(payload)
                    .eq('id', editingId)
                if (error) throw error
                toast.success('Compromisso atualizado!')
            } else {
                const { error } = await supabase
                    .from('appointments')
                    .insert(payload)
                if (error) throw error
                toast.success('Compromisso criado!')
            }

            setShowModal(false)
            loadAppointments()
            loadMonthDots()
        } catch (error) {
            console.error('Error saving appointment:', error)
            toast.error('Erro ao salvar')
        }
    }

    async function deleteAppointment(id: string) {
        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id)
            if (error) throw error
            toast.success('Compromisso excluído')
            loadAppointments()
            loadMonthDots()
        } catch (error) {
            console.error('Error deleting:', error)
            toast.error('Erro ao excluir')
        }
    }

    async function toggleComplete(apt: Appointment) {
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ completed: !apt.completed })
                .eq('id', apt.id)
            if (error) throw error
            loadAppointments()
        } catch (error) {
            console.error('Error toggling:', error)
        }
    }

    const calendarDays = getCalendarDays()
    const today = new Date()

    const selectedDateStr = selectedDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                        Agenda
                    </h1>
                    <p className="text-slate-400 mt-1">Organize seus compromissos</p>
                </div>
                <button
                    onClick={openNewAppointment}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                >
                    <Plus className="w-5 h-5" />
                    Novo Compromisso
                </button>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

                {/* Calendar */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm h-fit">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-5">
                        <button onClick={prevMonth} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <h2 className="text-lg font-semibold text-white">
                                {MONTHS[currentMonth.getMonth()]}
                            </h2>
                            <span className="text-xs text-slate-500">{currentMonth.getFullYear()}</span>
                        </div>
                        <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Today button */}
                    <button
                        onClick={goToToday}
                        className="w-full mb-4 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all"
                    >
                        Ir para Hoje
                    </button>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 mb-2">
                        {WEEKDAYS.map((day) => (
                            <div key={day} className="text-center py-2 text-xs font-medium text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-0.5">
                        {calendarDays.map(({ date, isCurrentMonth }, i) => {
                            const dateStr = formatDate(date)
                            const dots = monthDots[dateStr] || []
                            const _isToday = isToday(date)
                            const _isSelected = isSelected(date)

                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setSelectedDate(date)
                                        if (!isCurrentMonth) {
                                            setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                                        }
                                    }}
                                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all ${_isSelected
                                            ? 'bg-indigo-500/20 text-white ring-1 ring-indigo-500/50'
                                            : _isToday
                                                ? 'bg-white/5 text-indigo-400 font-semibold'
                                                : isCurrentMonth
                                                    ? 'text-slate-300 hover:bg-white/5'
                                                    : 'text-slate-600 hover:bg-white/5'
                                        }`}
                                >
                                    <span className={`${_isToday && !_isSelected ? 'underline underline-offset-2 decoration-indigo-500' : ''}`}>
                                        {date.getDate()}
                                    </span>
                                    {/* Category dots */}
                                    {dots.length > 0 && (
                                        <div className="flex gap-0.5 mt-0.5">
                                            {dots.slice(0, 3).map((cat, j) => (
                                                <div
                                                    key={j}
                                                    className={`w-1 h-1 rounded-full ${CATEGORY_COLORS[cat].dot}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-5 pt-4 border-t border-white/5">
                        <p className="text-xs text-slate-500 mb-3 font-medium">Categorias</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => (
                                <div key={key} className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[key].dot}`} />
                                    <span className="text-xs text-slate-400">{CATEGORIES[key].emoji} {CATEGORIES[key].label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Day details */}
                <div className="space-y-4">
                    {/* Selected date header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold text-white capitalize">
                                {selectedDateStr}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {appointments.length === 0
                                    ? 'Nenhum compromisso'
                                    : `${appointments.length} compromisso${appointments.length > 1 ? 's' : ''}`}
                            </p>
                        </div>
                        <button
                            onClick={openNewAppointment}
                            className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-indigo-400 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Appointments list */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-20 bg-slate-800/50 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                                <CalendarIcon className="w-10 h-10 text-slate-600" />
                            </div>
                            <h4 className="text-lg font-medium text-slate-400 mb-1">Dia livre!</h4>
                            <p className="text-sm text-slate-600 mb-6">Nenhum compromisso nesta data</p>
                            <button
                                onClick={openNewAppointment}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm font-medium transition-all flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar compromisso
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {appointments.map((apt) => {
                                const cat = apt.category as CategoryKey
                                const colors = CATEGORY_COLORS[cat]
                                const catInfo = CATEGORIES[cat]

                                return (
                                    <div
                                        key={apt.id}
                                        className={`group relative ${colors.bg} border ${colors.border} rounded-2xl p-4 transition-all hover:scale-[1.01]`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Complete toggle */}
                                            <button
                                                onClick={() => toggleComplete(apt)}
                                                className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${apt.completed
                                                        ? `${colors.dot} border-transparent`
                                                        : `border-slate-600 hover:${colors.border}`
                                                    }`}
                                            >
                                                {apt.completed && <Check className="w-3 h-3 text-white" />}
                                            </button>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
                                                        {catInfo.emoji} {catInfo.label}
                                                    </span>
                                                    {(apt.start_time || apt.end_time) && (
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatTimeDisplay(apt.start_time)}
                                                            {apt.end_time && ` - ${formatTimeDisplay(apt.end_time)}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className={`font-medium ${apt.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                                                    {apt.title}
                                                </h4>
                                                {apt.description && (
                                                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                                        {apt.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditAppointment(apt)}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteAppointment(apt.id)}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5">
                            <h3 className="text-lg font-semibold text-white">
                                {editingId ? 'Editar Compromisso' : 'Novo Compromisso'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Título *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                    placeholder="Ex: Aula de Cardiologia"
                                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Detalhes opcionais..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Data</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                />
                            </div>

                            {/* Time row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">Início</label>
                                    <input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData(p => ({ ...p, start_time: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">Fim</label>
                                    <input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData(p => ({ ...p, end_time: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-2 block">Categoria</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => {
                                        const cat = CATEGORIES[key]
                                        const colors = CATEGORY_COLORS[key]
                                        const isActive = formData.category === key
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, category: key }))}
                                                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${isActive
                                                        ? `${colors.bg} ${colors.border} ${colors.text} ring-1 ${colors.border}`
                                                        : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-white/5'
                                                    }`}
                                            >
                                                <span>{cat.emoji}</span>
                                                {cat.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex gap-3 p-5 border-t border-white/5">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 rounded-xl font-medium transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveAppointment}
                                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
                            >
                                {editingId ? 'Salvar' : 'Criar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
