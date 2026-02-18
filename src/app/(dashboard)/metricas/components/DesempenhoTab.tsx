'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AccuracyBadge, Skeleton, EmptyState } from '@/components/ui'
import { BarChart3, ChevronDown, ChevronRight, Filter, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Copy, Check, Sparkles } from 'lucide-react'
import { format, subDays, subMonths } from 'date-fns'
import { toast } from 'sonner'

interface TopicStats {
    id: number
    name: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
}

interface SubdisciplineStats {
    id: number
    name: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
    topics: TopicStats[]
}

interface DisciplineStats {
    id: number
    name: string
    totalQuestions: number
    totalCorrect: number
    accuracy: number
    trend: number | null // pp change vs previous period
    subdisciplines: SubdisciplineStats[]
}

type PeriodFilter = '30d' | '3m' | '6m' | '1y' | 'all'

const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '3m', label: 'Últimos 3 meses' },
    { value: '6m', label: 'Últimos 6 meses' },
    { value: '1y', label: 'Último ano' },
    { value: 'all', label: 'Tudo' },
]

export default function DesempenhoTab() {
    const [stats, setStats] = useState<DisciplineStats[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<PeriodFilter>('all')
    const [expandedDiscipline, setExpandedDiscipline] = useState<number | null>(null)
    const [expandedSubdiscipline, setExpandedSubdiscipline] = useState<number | null>(null)
    const [copied, setCopied] = useState(false)
    const [promptDiscipline, setPromptDiscipline] = useState<string>('all')
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [period])

    function getDateRange(p: PeriodFilter): { start: string | null; end: string } {
        const today = new Date()
        const end = format(today, 'yyyy-MM-dd')
        switch (p) {
            case '30d': return { start: format(subDays(today, 30), 'yyyy-MM-dd'), end }
            case '3m': return { start: format(subMonths(today, 3), 'yyyy-MM-dd'), end }
            case '6m': return { start: format(subMonths(today, 6), 'yyyy-MM-dd'), end }
            case '1y': return { start: format(subMonths(today, 12), 'yyyy-MM-dd'), end }
            case 'all': return { start: null, end }
        }
    }

    async function loadData() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const range = getDateRange(period)

            // Build current period query
            let currentQuery = supabase
                .from('question_logs')
                .select(`
                    discipline_id,
                    subdiscipline_id,
                    topic_id,
                    questions_done,
                    correct_answers,
                    date,
                    disciplines(id, name),
                    subdisciplines(id, name),
                    topics(id, name)
                `)
                .eq('user_id', user.id)

            if (range.start) {
                currentQuery = currentQuery.gte('date', range.start)
            }
            currentQuery = currentQuery.lte('date', range.end)

            // Build previous period query for trends (same duration, shifted back)
            let previousQuery: any = null
            if (range.start) {
                const today = new Date()
                const periodDays = Math.round((today.getTime() - new Date(range.start).getTime()) / (1000 * 60 * 60 * 24))
                const prevStart = format(subDays(new Date(range.start), periodDays), 'yyyy-MM-dd')
                const prevEnd = range.start

                previousQuery = supabase
                    .from('question_logs')
                    .select('discipline_id, questions_done, correct_answers')
                    .eq('user_id', user.id)
                    .gte('date', prevStart)
                    .lt('date', prevEnd)
            }

            const currentResult = await currentQuery
            const currentLogs = currentResult.data || []

            let previousLogs: any[] = []
            if (previousQuery) {
                const prevResult = await previousQuery
                previousLogs = prevResult.data || []
            }

            // Aggregate previous period by discipline for trends
            const prevMap: { [key: number]: { q: number; c: number } } = {}
            previousLogs.forEach((log: any) => {
                if (!log.discipline_id) return
                if (!prevMap[log.discipline_id]) prevMap[log.discipline_id] = { q: 0, c: 0 }
                prevMap[log.discipline_id].q += log.questions_done
                prevMap[log.discipline_id].c += log.correct_answers
            })

            // Aggregate current period
            const disciplineMap: { [key: number]: DisciplineStats } = {}

            currentLogs.forEach((log: any) => {
                if (!log.discipline_id || !log.disciplines) return

                const discId = log.discipline_id
                const disc = log.disciplines as { id: number; name: string }

                // Initialize discipline
                if (!disciplineMap[discId]) {
                    disciplineMap[discId] = {
                        id: discId,
                        name: disc.name,
                        totalQuestions: 0,
                        totalCorrect: 0,
                        accuracy: 0,
                        trend: null,
                        subdisciplines: []
                    }
                }

                disciplineMap[discId].totalQuestions += log.questions_done
                disciplineMap[discId].totalCorrect += log.correct_answers

                // Aggregate subdiscipline
                if (log.subdiscipline_id && log.subdisciplines) {
                    const sub = log.subdisciplines as { id: number; name: string }
                    let existingSub = disciplineMap[discId].subdisciplines.find(s => s.id === sub.id)

                    if (!existingSub) {
                        existingSub = {
                            id: sub.id,
                            name: sub.name,
                            totalQuestions: 0,
                            totalCorrect: 0,
                            accuracy: 0,
                            topics: []
                        }
                        disciplineMap[discId].subdisciplines.push(existingSub)
                    }

                    existingSub.totalQuestions += log.questions_done
                    existingSub.totalCorrect += log.correct_answers

                    // Aggregate topic
                    if (log.topic_id && log.topics) {
                        const topic = log.topics as { id: number; name: string }
                        let existingTopic = existingSub.topics.find(t => t.id === topic.id)

                        if (!existingTopic) {
                            existingTopic = {
                                id: topic.id,
                                name: topic.name,
                                totalQuestions: 0,
                                totalCorrect: 0,
                                accuracy: 0
                            }
                            existingSub.topics.push(existingTopic)
                        }

                        existingTopic.totalQuestions += log.questions_done
                        existingTopic.totalCorrect += log.correct_answers
                    }
                }
            })

            // Calculate accuracies and trends
            const result = Object.values(disciplineMap)
                .map(disc => {
                    disc.accuracy = disc.totalQuestions > 0
                        ? (disc.totalCorrect / disc.totalQuestions) * 100
                        : 0

                    // Calculate trend
                    const prev = prevMap[disc.id]
                    if (prev && prev.q >= 5) {
                        const prevAccuracy = (prev.c / prev.q) * 100
                        disc.trend = disc.accuracy - prevAccuracy
                    }

                    // Calculate subdiscipline accuracies
                    disc.subdisciplines = disc.subdisciplines
                        .map(sub => {
                            sub.accuracy = sub.totalQuestions > 0
                                ? (sub.totalCorrect / sub.totalQuestions) * 100
                                : 0

                            // Calculate topic accuracies
                            sub.topics = sub.topics
                                .map(t => ({
                                    ...t,
                                    accuracy: t.totalQuestions > 0
                                        ? (t.totalCorrect / t.totalQuestions) * 100
                                        : 0
                                }))
                                .sort((a, b) => a.accuracy - b.accuracy)

                            return sub
                        })
                        .sort((a, b) => a.accuracy - b.accuracy)

                    return disc
                })
                .sort((a, b) => a.accuracy - b.accuracy)

            setStats(result)
        } catch (error) {
            console.error('Error loading desempenho data:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleDiscipline = (id: number) => {
        setExpandedDiscipline(expandedDiscipline === id ? null : id)
        setExpandedSubdiscipline(null)
    }

    const toggleSubdiscipline = (id: number) => {
        setExpandedSubdiscipline(expandedSubdiscipline === id ? null : id)
    }

    function generateAndCopyPrompt() {
        // Filter stats by selected discipline if not 'all'
        const filteredStats = promptDiscipline === 'all'
            ? stats
            : stats.filter(d => String(d.id) === promptDiscipline)

        // Try to collect items at the most granular level available
        // Level 1: Topics
        const weakItems: { name: string; context: string; accuracy: number; questions: number }[] = []

        filteredStats.forEach(disc => {
            disc.subdisciplines.forEach(sub => {
                sub.topics.forEach(topic => {
                    weakItems.push({
                        name: topic.name,
                        context: `${disc.name} > ${sub.name}`,
                        accuracy: Math.round(topic.accuracy),
                        questions: topic.totalQuestions
                    })
                })
            })
        })

        // Level 2: If no topics, try subdisciplines
        if (weakItems.length === 0) {
            filteredStats.forEach(disc => {
                disc.subdisciplines.forEach(sub => {
                    weakItems.push({
                        name: sub.name,
                        context: disc.name,
                        accuracy: Math.round(sub.accuracy),
                        questions: sub.totalQuestions
                    })
                })
            })
        }

        // Level 3: If no subdisciplines, use disciplines
        if (weakItems.length === 0) {
            filteredStats.forEach(disc => {
                weakItems.push({
                    name: disc.name,
                    context: 'Grande Área',
                    accuracy: Math.round(disc.accuracy),
                    questions: disc.totalQuestions
                })
            })
        }

        if (weakItems.length === 0) {
            toast.error('Não há dados suficientes para gerar o prompt.')
            return
        }

        // Sort by accuracy ascending (worst first), take top 20
        weakItems.sort((a, b) => a.accuracy - b.accuracy)
        const selected = weakItems.filter(t => t.accuracy < 75)
        const items = selected.length > 0 ? selected.slice(0, 20) : weakItems.slice(0, 15)

        const topicList = items
            .map((t, i) => `${i + 1}. **${t.name}** (${t.context}) — ${t.accuracy}% de acerto em ${t.questions} questões`)
            .join('\n')

        const disciplineLabel = promptDiscipline === 'all'
            ? 'todas as disciplinas'
            : filteredStats[0]?.name || 'disciplina selecionada'

        const prompt = `Sou estudante de medicina me preparando para provas de residência médica. Preciso que você crie flashcards (pergunta e resposta) para os assuntos em que estou com pior desempenho em ${disciplineLabel}.

Crie flashcards focados nos conceitos mais cobrados em provas de residência para cada assunto listado abaixo. Cada flashcard deve ter:
- Uma pergunta objetiva e direta
- Uma resposta concisa com o ponto-chave
- Foque nos conceitos que mais caem em prova

### Meus assuntos mais fracos:

${topicList}

Por favor, crie pelo menos 3 flashcards por assunto, priorizando os que têm menor % de acerto.

### FORMATO OBRIGATÓRIO DE SAÍDA:

Use EXATAMENTE este formato para cada flashcard (necessário para importação automática nos baralhos corretos):

**Disciplina:** [Nome da Disciplina]
**Subdisciplina:** [Nome da Subdisciplina]
**Assunto:** [Nome do Assunto]
**Pergunta:** [sua pergunta aqui]
**Resposta:** [sua resposta aqui]

---

**Disciplina:** [Nome da próxima Disciplina]
**Subdisciplina:** [Nome da próxima Subdisciplina]
**Assunto:** [Nome do próximo Assunto]
**Pergunta:** [próxima pergunta]
**Resposta:** [próxima resposta]

IMPORTANTE: 
1. Mantenha os nomes da Disciplina, Subdisciplina e Assunto EXATAMENTE como aparecem na lista de "assuntos mais fracos" acima.
2. Use os marcadores em negrito (**Disciplina:**, etc.) exatamente como mostrado.`

        try {
            // Fallback clipboard copy that works on HTTP
            const textarea = document.createElement('textarea')
            textarea.value = prompt
            textarea.style.position = 'fixed'
            textarea.style.opacity = '0'
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)

            setCopied(true)
            toast.success('Prompt copiado! Cole em qualquer IA para gerar flashcards.')
            setTimeout(() => setCopied(false), 3000)
        } catch {
            toast.error('Erro ao copiar. Tente novamente.')
        }
    }

    // Summary stats
    const totalQuestions = stats.reduce((sum, s) => sum + s.totalQuestions, 0)
    const totalCorrect = stats.reduce((sum, s) => sum + s.totalCorrect, 0)
    const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
    const criticalCount = stats.filter(s => s.accuracy < 60).length
    const strongCount = stats.filter(s => s.accuracy >= 80).length

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
            </div>
        )
    }

    if (stats.length === 0) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <EmptyState
                    icon={BarChart3}
                    title="Sem dados de desempenho"
                    description="Registre questões para ver sua análise de desempenho por disciplina."
                />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Análise de Desempenho</h3>
                    <p className="text-sm text-zinc-400">
                        Clique em uma disciplina para expandir subdisciplinas e assuntos
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={promptDiscipline}
                        onChange={(e) => setPromptDiscipline(e.target.value)}
                        className="bg-zinc-800 border border-indigo-500/30 text-indigo-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px]"
                    >
                        <option value="all">Todas disciplinas</option>
                        {stats.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={generateAndCopyPrompt}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${copied
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20'
                            }`}
                        title="Gerar prompt com seus assuntos fracos para criar flashcards com IA"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {copied ? 'Copiado!' : 'Exportar Prompt'}
                    </button>
                    <Filter className="w-4 h-4 text-zinc-400" />
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {periodOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <p className="text-xs text-zinc-400 mb-1">Total</p>
                    <p className="text-xl font-bold text-white">{totalQuestions.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-zinc-500">questões</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <p className="text-xs text-zinc-400 mb-1">Aproveitamento</p>
                    <AccuracyBadge accuracy={overallAccuracy} size="lg" />
                </div>
                <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
                    <p className="text-xs text-red-400 mb-1">Críticas (&lt;60%)</p>
                    <p className="text-xl font-bold text-red-400">{criticalCount}</p>
                    <p className="text-xs text-zinc-500">disciplinas</p>
                </div>
                <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/20">
                    <p className="text-xs text-green-400 mb-1">Fortes (&gt;80%)</p>
                    <p className="text-xl font-bold text-green-400">{strongCount}</p>
                    <p className="text-xs text-zinc-500">disciplinas</p>
                </div>
            </div>

            {/* Discipline list */}
            <div className="space-y-2">
                {stats.map(disc => {
                    const isExpanded = expandedDiscipline === disc.id
                    const colorClass = disc.accuracy < 60
                        ? 'border-red-500/20 hover:border-red-500/40'
                        : disc.accuracy < 75
                            ? 'border-amber-500/20 hover:border-amber-500/40'
                            : 'border-green-500/20 hover:border-green-500/40'
                    const bgClass = disc.accuracy < 60
                        ? 'bg-red-500/5'
                        : disc.accuracy < 75
                            ? 'bg-amber-500/5'
                            : 'bg-green-500/5'
                    const barColor = disc.accuracy < 60
                        ? 'bg-red-500'
                        : disc.accuracy < 75
                            ? 'bg-amber-500'
                            : 'bg-green-500'

                    return (
                        <div
                            key={disc.id}
                            className={`rounded-xl border transition-all ${colorClass} ${bgClass}`}
                        >
                            {/* Discipline header */}
                            <div
                                className="flex items-center gap-3 p-4 cursor-pointer"
                                onClick={() => toggleDiscipline(disc.id)}
                            >
                                {isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                }
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-white truncate">{disc.name}</h3>
                                        {/* Trend badge */}
                                        {disc.trend !== null && (
                                            <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${disc.trend < -2
                                                ? 'bg-red-500/10 text-red-400'
                                                : disc.trend > 2
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-zinc-500/10 text-zinc-400'
                                                }`}>
                                                {disc.trend < -2
                                                    ? <ArrowDown className="w-3 h-3" />
                                                    : disc.trend > 2
                                                        ? <ArrowUp className="w-3 h-3" />
                                                        : <Minus className="w-3 h-3" />
                                                }
                                                {disc.trend > 0 ? '+' : ''}{disc.trend.toFixed(0)}pp
                                            </span>
                                        )}
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-2 h-1.5 bg-zinc-700/30 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                            style={{ width: `${disc.accuracy}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 ml-2 flex-shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-zinc-500">Questões</p>
                                        <p className="text-sm font-medium text-zinc-300">{disc.totalQuestions.toLocaleString('pt-BR')}</p>
                                    </div>
                                    <AccuracyBadge accuracy={disc.accuracy} />
                                </div>
                            </div>

                            {/* Expanded subdisciplines */}
                            {isExpanded && disc.subdisciplines.length > 0 && (
                                <div className="px-4 pb-4 space-y-1.5 border-t border-zinc-700/20 pt-3 ml-4 animate-fade-in">
                                    {disc.subdisciplines.map(sub => {
                                        const isSubExpanded = expandedSubdiscipline === sub.id
                                        return (
                                            <div key={sub.id}>
                                                <div
                                                    className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
                                                    onClick={() => toggleSubdiscipline(sub.id)}
                                                >
                                                    {sub.topics.length > 0 ? (
                                                        isSubExpanded
                                                            ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                                            : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-3.5 flex-shrink-0" />
                                                    )}
                                                    <span className="flex-1 text-sm text-zinc-300 truncate">{sub.name}</span>
                                                    <span className="text-xs text-zinc-500 mr-3">{sub.totalQuestions}q</span>
                                                    <span className={`text-xs font-bold w-10 text-right ${sub.accuracy < 60 ? 'text-red-400' :
                                                        sub.accuracy < 75 ? 'text-amber-400' :
                                                            'text-green-400'
                                                        }`}>
                                                        {sub.accuracy.toFixed(0)}%
                                                    </span>
                                                </div>

                                                {/* Expanded topics */}
                                                {isSubExpanded && sub.topics.length > 0 && (
                                                    <div className="ml-6 pl-4 border-l border-zinc-700/30 space-y-1 py-1 animate-fade-in">
                                                        {sub.topics.map(topic => (
                                                            <div key={topic.id} className="flex items-center gap-2 py-1.5 px-2">
                                                                <span className="flex-1 text-xs text-zinc-400 truncate">{topic.name}</span>
                                                                <span className="text-[10px] text-zinc-600 mr-2">{topic.totalQuestions}q</span>
                                                                <div className="w-16 h-1 bg-zinc-700/30 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${topic.accuracy < 60 ? 'bg-red-500' :
                                                                            topic.accuracy < 75 ? 'bg-amber-500' :
                                                                                'bg-green-500'
                                                                            }`}
                                                                        style={{ width: `${topic.accuracy}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-[10px] font-bold w-8 text-right ${topic.accuracy < 60 ? 'text-red-400' :
                                                                    topic.accuracy < 75 ? 'text-amber-400' :
                                                                        'text-green-400'
                                                                    }`}>
                                                                    {topic.accuracy.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {isExpanded && disc.subdisciplines.length === 0 && (
                                <div className="px-4 pb-4 border-t border-zinc-700/20 pt-3 ml-4">
                                    <p className="text-sm text-zinc-500">Nenhuma subdisciplina registrada.</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
