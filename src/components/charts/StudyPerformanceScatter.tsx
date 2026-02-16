'use client'

import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ZAxis,
    TooltipProps
} from 'recharts'

interface DataPoint {
    questionsDone: number
    score: number // 0-100
    week: string
}

interface StudyPerformanceScatterProps {
    data: DataPoint[]
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as DataPoint
        return (
            <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl text-xs">
                <p className="font-bold text-white mb-1">{data.week}</p>
                <div className="space-y-1 text-zinc-300">
                    <p>📚 Questões: <span className="text-white">{data.questionsDone}</span></p>
                    <p>🎯 Desempenho: <span className="text-green-400">{data.score.toFixed(1)}%</span></p>
                </div>
            </div>
        )
    }
    return null
}

export default function StudyPerformanceScatter({ data }: StudyPerformanceScatterProps) {
    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                    margin={{
                        top: 20,
                        right: 20,
                        bottom: 20,
                        left: 20,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.3} />
                    <XAxis
                        type="number"
                        dataKey="questionsDone"
                        name="Questões"
                        unit=""
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        label={{ value: 'Questões Feitas na Semana', position: 'bottom', fill: '#71717a', fontSize: 12, offset: 0 }}
                    />
                    <YAxis
                        type="number"
                        dataKey="score"
                        name="Nota"
                        unit="%"
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        domain={[0, 100]}
                        label={{ value: 'Performance Média (%)', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 12 }}
                    />
                    <ZAxis type="number" range={[50, 400]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter
                        name="Performance"
                        data={data}
                        fill="#8884d8"
                    >
                        {data.map((entry, index) => (
                            <circle
                                key={`cell-${index}`}
                                cx={0}
                                cy={0}
                                r={entry.questionsDone > 100 ? 8 : 5}
                                fill={entry.score > 80 ? '#4ade80' : entry.score > 60 ? '#facc15' : '#ef4444'}
                                strokeWidth={2}
                                stroke={entry.score > 80 ? '#22c55e' : entry.score > 60 ? '#eab308' : '#dc2626'}
                                opacity={0.8}
                            />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    )
}
