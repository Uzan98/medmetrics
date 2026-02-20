import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, AlertCircle, CheckCircle2 } from 'lucide-react'

interface UpcomingReviewsProps {
    entries: any[]
}

export function UpcomingReviews({ entries }: UpcomingReviewsProps) {
    const todayDate = new Date()
    const todayStr = format(todayDate, 'yyyy-MM-dd')

    // Generate the next 7 days
    const days = Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(todayDate, i)
        const dateStr = format(date, 'yyyy-MM-dd')

        let count = 0
        if (i === 0) {
            // "Hoje": count all overdue and today
            count = entries.filter(entry => {
                const nextReview = entry.next_review_date
                return !nextReview || nextReview <= todayStr
            }).length
        } else {
            // Future days: count exactly that day
            count = entries.filter(entry => {
                const nextReview = entry.next_review_date
                return nextReview === dateStr
            }).length
        }

        return {
            date,
            dateStr,
            count,
            isToday: i === 0,
            isTomorrow: i === 1
        }
    })

    const maxCount = Math.max(...days.map(d => d.count), 1) // Avoid division by zero

    return (
        <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-zinc-800/80 p-5 mt-5">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">Previsão de Revisões</h2>
                    <p className="text-sm text-zinc-400">Cards agendados para os próximos 7 dias</p>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {days.map((day, idx) => {
                    // Determine styling based on count and day
                    const hasCards = day.count > 0

                    let bgClasses = 'bg-zinc-800/40 border-zinc-700/40'
                    let textClasses = 'text-zinc-500'
                    let valueClasses = 'text-white'

                    if (day.isToday && hasCards) {
                        bgClasses = 'bg-emerald-500/10 border-emerald-500/30'
                        textClasses = 'text-emerald-400'
                        valueClasses = 'text-emerald-400 font-black'
                    } else if (day.isToday && !hasCards) {
                        bgClasses = 'bg-zinc-800/60 border-zinc-700/50'
                        textClasses = 'text-zinc-400'
                    } else if (hasCards) {
                        bgClasses = 'bg-indigo-500/10 border-indigo-500/20'
                        textClasses = 'text-indigo-300'
                        valueClasses = 'text-white font-bold'
                    }

                    // Intensity bar width
                    const barWidth = `${(day.count / maxCount) * 100}%`

                    return (
                        <div
                            key={day.dateStr}
                            className={`flex flex-col rounded-xl border p-3 transition-colors ${bgClasses}`}
                        >
                            <span className={`text-[11px] uppercase tracking-wider font-semibold mb-1 ${textClasses}`}>
                                {day.isToday ? 'Hoje' : day.isTomorrow ? 'Amanhã' : format(day.date, 'EEEE', { locale: ptBR }).split('-')[0]}
                            </span>
                            <span className="text-xs text-zinc-500 mb-2">
                                {format(day.date, 'dd/MM')}
                            </span>

                            <div className="mt-auto">
                                <span className={`text-xl ${valueClasses}`}>
                                    {day.count}
                                </span>

                                {/* Intensity Bar */}
                                <div className="h-1.5 w-full bg-black/20 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${day.isToday && hasCards ? 'bg-emerald-500' : hasCards ? 'bg-indigo-500' : 'bg-transparent'}`}
                                        style={{ width: barWidth }}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
