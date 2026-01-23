import { clsx, type ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs)
}

export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date))
}

export function formatPercent(value: number | null): string {
    if (value === null) return '0%'
    return `${value.toFixed(1)}%`
}

export function getAccuracyColor(accuracy: number | null): string {
    if (accuracy === null) return 'text-gray-400'
    if (accuracy < 60) return 'text-red-500'
    if (accuracy < 75) return 'text-yellow-500'
    return 'text-green-500'
}

export function getAccuracyBgColor(accuracy: number | null): string {
    if (accuracy === null) return 'bg-gray-100 dark:bg-gray-800'
    if (accuracy < 60) return 'bg-red-100 dark:bg-red-900/30'
    if (accuracy < 75) return 'bg-yellow-100 dark:bg-yellow-900/30'
    return 'bg-green-100 dark:bg-green-900/30'
}

export function calculateAccuracy(correct: number, total: number): number {
    if (total === 0) return 0
    return (correct / total) * 100
}

export function getMonthName(month: number): string {
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril',
        'Maio', 'Junho', 'Julho', 'Agosto',
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return months[month - 1] || ''
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return { start, end }
}
