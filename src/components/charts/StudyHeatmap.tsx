'use client'

import { useMemo, useState } from 'react'
import { format, subDays, startOfYear, eachDayOfInterval, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface HeatmapDay {
    date: string
    count: number
    level: number
}

interface StudyHeatmapProps {
    data: HeatmapDay[]
}

const CELL_SIZE = 13
const CELL_GAP = 3
const CELL_ROUND = 3
const MONTH_LABEL_HEIGHT = 20
const DAY_LABEL_WIDTH = 28

const COLORS = [
    '#18181b', // level 0 — no activity
    '#312e81', // level 1 — light
    '#4338ca', // level 2
    '#6366f1', // level 3
    '#818cf8', // level 4 — max
]

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', '']

export default function StudyHeatmap({ data }: StudyHeatmapProps) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

    const { weeks, monthLabels, totalCount } = useMemo(() => {
        // Build a map of date -> day data
        const dataMap = new Map<string, HeatmapDay>()
        data.forEach(d => dataMap.set(d.date, d))

        // Generate all days for the full current year (Jan 1 → Dec 31)
        const today = new Date()
        const yearStart = new Date(today.getFullYear(), 0, 1)
        const yearEnd = new Date(today.getFullYear(), 11, 31)

        // Adjust start to the previous Sunday (start of week)
        const startDay = getDay(yearStart) // 0=Sun
        const adjustedStart = subDays(yearStart, startDay)

        const allDays = eachDayOfInterval({ start: adjustedStart, end: yearEnd })

        // Group into weeks (columns)
        const weeks: { date: string; count: number; level: number; dayOfWeek: number }[][] = []
        let currentWeek: typeof weeks[0] = []

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayData = dataMap.get(dateStr)
            const dayOfWeek = getDay(day)

            currentWeek.push({
                date: dateStr,
                count: dayData?.count || 0,
                level: dayData?.level || 0,
                dayOfWeek,
            })

            if (dayOfWeek === 6) { // Saturday = end of week
                weeks.push(currentWeek)
                currentWeek = []
            }
        })

        if (currentWeek.length > 0) {
            weeks.push(currentWeek)
        }

        // Calculate month labels with positions
        const monthLabels: { label: string; x: number }[] = []
        let lastMonth = -1
        weeks.forEach((week, weekIdx) => {
            const firstDay = week[0]
            if (firstDay) {
                const month = new Date(firstDay.date).getMonth()
                if (month !== lastMonth) {
                    monthLabels.push({
                        label: MONTH_NAMES[month],
                        x: weekIdx * (CELL_SIZE + CELL_GAP) + DAY_LABEL_WIDTH,
                    })
                    lastMonth = month
                }
            }
        })

        let totalCount = 0
        data.forEach(d => { totalCount += d.count })

        return { weeks, monthLabels, totalCount }
    }, [data])

    const svgWidth = DAY_LABEL_WIDTH + weeks.length * (CELL_SIZE + CELL_GAP)
    const svgHeight = MONTH_LABEL_HEIGHT + 7 * (CELL_SIZE + CELL_GAP)

    return (
        <div className="w-full space-y-3">
            <div className="w-full overflow-x-auto pb-2">
                <svg
                    width={svgWidth}
                    height={svgHeight}
                    className="select-none"
                    style={{ minWidth: svgWidth }}
                >
                    {/* Month Labels */}
                    {monthLabels.map((m, i) => (
                        <text
                            key={i}
                            x={m.x}
                            y={14}
                            className="fill-zinc-500"
                            fontSize={11}
                            fontFamily="system-ui, sans-serif"
                        >
                            {m.label}
                        </text>
                    ))}

                    {/* Day Labels */}
                    {DAY_LABELS.map((label, i) => (
                        label ? (
                            <text
                                key={i}
                                x={0}
                                y={MONTH_LABEL_HEIGHT + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
                                className="fill-zinc-500"
                                fontSize={10}
                                fontFamily="system-ui, sans-serif"
                            >
                                {label}
                            </text>
                        ) : null
                    ))}

                    {/* Cells */}
                    {weeks.map((week, weekIdx) =>
                        week.map((day) => {
                            const x = DAY_LABEL_WIDTH + weekIdx * (CELL_SIZE + CELL_GAP)
                            const y = MONTH_LABEL_HEIGHT + day.dayOfWeek * (CELL_SIZE + CELL_GAP)

                            return (
                                <rect
                                    key={day.date}
                                    x={x}
                                    y={y}
                                    width={CELL_SIZE}
                                    height={CELL_SIZE}
                                    rx={CELL_ROUND}
                                    ry={CELL_ROUND}
                                    fill={COLORS[day.level]}
                                    stroke={day.level > 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)'}
                                    strokeWidth={1}
                                    className="cursor-pointer transition-opacity hover:opacity-80"
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const parent = e.currentTarget.closest('.w-full')?.getBoundingClientRect()
                                        setTooltip({
                                            x: rect.left - (parent?.left || 0) + CELL_SIZE / 2,
                                            y: rect.top - (parent?.top || 0) - 8,
                                            text: `${day.count} questões — ${format(new Date(day.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}`,
                                        })
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            )
                        })
                    )}
                </svg>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="absolute pointer-events-none z-50 px-2.5 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 shadow-xl whitespace-nowrap"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    {tooltip.text}
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>{totalCount.toLocaleString('pt-BR')} questões no período</span>
                <div className="flex items-center gap-1.5">
                    <span>Menos</span>
                    {COLORS.map((color, i) => (
                        <div
                            key={i}
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: color, border: '1px solid rgba(255,255,255,0.06)' }}
                        />
                    ))}
                    <span>Mais</span>
                </div>
            </div>
        </div>
    )
}
