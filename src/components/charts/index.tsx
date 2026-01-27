'use client'

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'

interface ChartData {
    name: string
    [key: string]: string | number
}

interface AccuracyLineChartProps {
    data: ChartData[]
    dataKey?: string
    height?: number
}

export function AccuracyLineChart({
    data,
    dataKey = 'accuracy',
    height = 300,
}: AccuracyLineChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    itemStyle={{ color: '#94a3b8' }}
                    formatter={(value) => [`${(value as number)?.toFixed(1) ?? 0}%`, 'Acerto']}
                />
                <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#1e293b', strokeWidth: 2 }}
                />
                <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
            </LineChart>
        </ResponsiveContainer>
    )
}

interface QuestionsBarChartProps {
    data: ChartData[]
    dataKey?: string
    height?: number
}

export function QuestionsBarChart({
    data,
    dataKey = 'questions',
    height = 300,
}: QuestionsBarChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    itemStyle={{ color: '#94a3b8' }}
                    formatter={(value) => [(value as number)?.toLocaleString('pt-BR') ?? 0, 'Questões']}
                />
                <Bar
                    dataKey={dataKey}
                    fill="url(#barGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                />
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                </defs>
            </BarChart>
        </ResponsiveContainer>
    )
}

interface DisciplineComparisonChartProps {
    data: { name: string; accuracy: number; questions: number }[]
    height?: number
}

export function DisciplineComparisonChart({
    data,
    height = 400,
}: DisciplineComparisonChartProps) {
    // Sort by accuracy descending
    const sortedData = [...data].sort((a, b) => b.accuracy - a.accuracy)

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={sortedData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                    type="number"
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                />
                <Tooltip
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    formatter={(value, name) => {
                        const v = value as number
                        if (name === 'accuracy') return [`${v?.toFixed(1) ?? 0}%`, 'Acerto']
                        return [v?.toLocaleString('pt-BR') ?? 0, 'Questões']
                    }}
                />
                <Legend
                    wrapperStyle={{ color: '#94a3b8' }}
                    formatter={(value) => (value === 'accuracy' ? 'Acerto' : 'Questões')}
                />
                <Bar
                    dataKey="accuracy"
                    fill="url(#accuracyGradient)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={30}
                />
                <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
            </BarChart>
        </ResponsiveContainer>
    )
}


interface MonthlyEvolutionChartProps {
    data: { name: string; questions: number; accuracy: number }[]
    height?: number
}

export function MonthlyEvolutionChart({
    data,
    height = 350,
}: MonthlyEvolutionChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    formatter={(value, name) => {
                        const v = value as number
                        if (name === 'accuracy') return [`${v?.toFixed(1) ?? 0}%`, 'Acerto']
                        return [v?.toLocaleString('pt-BR') ?? 0, 'Questões']
                    }}
                />
                <Legend
                    wrapperStyle={{ color: '#94a3b8' }}
                    formatter={(value) => (value === 'accuracy' ? 'Acerto' : 'Questões')}
                />
                <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="questions"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 0, r: 4 }}
                />
                <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}

interface DisciplineRadarChartProps {
    data: { subject: string; A: number; fullMark: number }[]
    height?: number
}

import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    PieChart,
    Pie,
    Cell,
} from 'recharts'

export function DisciplineRadarChart({
    data,
    height = 300,
}: DisciplineRadarChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                />
                <Radar
                    name="Aproveitamento"
                    dataKey="A"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                />
                <Tooltip
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    formatter={(value) => [`${(value as number)?.toFixed(1) ?? 0}%`, 'Aproveitamento']}
                />
            </RadarChart>
        </ResponsiveContainer>
    )
}

interface StudyDistributionChartProps {
    data: { name: string; value: number }[]
    height?: number
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

export function StudyDistributionChart({
    data,
    height = 300,
}: StudyDistributionChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                    itemStyle={{ color: '#f1f5f9' }}
                    formatter={(value) => [(value as number)?.toLocaleString('pt-BR') ?? 0, 'Questões']}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    )
}

interface ActivityHeatmapProps {
    data: { date: string; count: number }[]
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
    const today = new Date()
    const startDate = new Date(today.getFullYear(), 0, 1) // Jan 1st of current year

    // Generate all days of the year
    const days = []
    let currentDate = new Date(startDate)

    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const found = data.find(d => d.date === dateStr)
        days.push({
            date: dateStr,
            count: found ? found.count : 0,
            month: currentDate.getMonth(),
            dayOfWeek: currentDate.getDay() // 0 = Sunday
        })
        currentDate.setDate(currentDate.getDate() + 1)
    }

    // Group by weeks for rendering
    const weeks = []
    let currentWeek: typeof days = []

    // Pad first week if needed
    for (let i = 0; i < days[0].dayOfWeek; i++) {
        currentWeek.push({ date: '', count: -1, month: -1, dayOfWeek: i })
    }

    days.forEach(day => {
        currentWeek.push(day)
        if (currentWeek.length === 7) {
            weeks.push(currentWeek)
            currentWeek = []
        }
    })

    if (currentWeek.length > 0) {
        weeks.push(currentWeek)
    }

    const getIntensityColor = (count: number) => {
        if (count === -1) return 'bg-transparent' // Padding
        if (count === 0) return 'bg-slate-800/50'
        if (count <= 10) return 'bg-emerald-900/50 border border-emerald-900'
        if (count <= 30) return 'bg-emerald-700/50 border border-emerald-700'
        if (count <= 50) return 'bg-emerald-500/50 border border-emerald-500'
        return 'bg-emerald-400 border border-emerald-400'
    }

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="min-w-[800px]">
                <div className="flex text-xs text-slate-500 mb-2 gap-[18px] pl-8">
                    {/* Simplified month labels - rendered every ~4 weeks approx */}
                    {months.map(m => (
                        <span key={m} className="w-8">{m}</span>
                    ))}
                </div>
                <div className="flex gap-1">
                    <div className="flex flex-col gap-1 pr-2 text-[10px] text-slate-500 pt-2">
                        <span className="h-3">Seg</span>
                        <span className="h-3">Quar</span>
                        <span className="h-3">Sex</span>
                    </div>
                    <div className="flex gap-1">
                        {weeks.map((week, i) => (
                            <div key={i} className="flex flex-col gap-1">
                                {week.map((day, j) => (
                                    <div
                                        key={`${i}-${j}`}
                                        className={`w-3 h-3 rounded-sm ${getIntensityColor(day.count)} transition-all hover:ring-2 hover:ring-white/20 relative group`}
                                    >
                                        {day.count >= 0 && (
                                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none border border-slate-700">
                                                {day.count} questões em {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 justify-end">
                    <span>Menos</span>
                    <div className="w-3 h-3 rounded-sm bg-slate-800/50" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-900/50" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-700/50" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-500/50" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                    <span>Mais</span>
                </div>
            </div>
        </div>
    )
}
