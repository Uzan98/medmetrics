import { LucideIcon } from 'lucide-react'
import { cn, formatPercent, getAccuracyColor } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon: LucideIcon
    trend?: {
        value: number
        label: string
    }
    accentColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

const accentColors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
}

export function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    accentColor = 'blue',
}: StatCardProps) {
    return (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div
                    className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br',
                        accentColors[accentColor]
                    )}
                >
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {trend && (
                    <div
                        className={cn(
                            'px-2.5 py-1 rounded-lg text-sm font-medium',
                            trend.value >= 0
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-red-500/10 text-red-400'
                        )}
                    >
                        {trend.value >= 0 ? '+' : ''}
                        {trend.value}% {trend.label}
                    </div>
                )}
            </div>
            <div>
                <p className="text-slate-400 text-sm mb-1">{title}</p>
                <p className="text-3xl font-bold text-white">{value}</p>
                {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
            </div>
        </div>
    )
}

interface AccuracyBadgeProps {
    accuracy: number | null
    size?: 'sm' | 'md' | 'lg'
}

export function AccuracyBadge({ accuracy, size = 'md' }: AccuracyBadgeProps) {
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
    }

    const getBgColor = (acc: number | null) => {
        if (acc === null) return 'bg-slate-500/10 text-slate-400'
        if (acc < 60) return 'bg-red-500/10 text-red-400'
        if (acc < 75) return 'bg-yellow-500/10 text-yellow-400'
        return 'bg-green-500/10 text-green-400'
    }

    return (
        <span
            className={cn(
                'rounded-lg font-semibold',
                sizeClasses[size],
                getBgColor(accuracy)
            )}
        >
            {formatPercent(accuracy)}
        </span>
    )
}

interface ProgressBarProps {
    current: number
    target: number
    label?: string
    showPercent?: boolean
}

export function ProgressBar({
    current,
    target,
    label,
    showPercent = true,
}: ProgressBarProps) {
    const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0
    const isComplete = percent >= 100

    return (
        <div className="space-y-2">
            {(label || showPercent) && (
                <div className="flex items-center justify-between text-sm">
                    {label && <span className="text-slate-400">{label}</span>}
                    {showPercent && (
                        <span className="text-slate-300 font-medium">
                            {current.toLocaleString('pt-BR')} / {target.toLocaleString('pt-BR')} ({percent.toFixed(0)}%)
                        </span>
                    )}
                </div>
            )}
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isComplete
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-500 to-blue-600'
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'animate-pulse bg-slate-700/50 rounded-lg',
                className
            )}
        />
    )
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-slate-400 max-w-sm mb-6">{description}</p>
            {action}
        </div>
    )
}

export { AddSubdisciplineModal } from './AddSubdisciplineModal'
export { AddTopicModal } from './AddTopicModal'
export { Speedometer } from './Speedometer'

