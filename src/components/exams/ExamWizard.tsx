'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle, Check, X, ChevronRight, FileJson, Save, CheckCircle2, Plus, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──

interface JsonQuestion {
    disciplina: string
    subdisciplina: string
    assunto: string
}

interface LoggedQuestion {
    id: number
    disciplineId?: number
    subdisciplineId?: number
    topicId?: number
    disciplineName: string
    subdisciplineName: string
    topicName: string
    isCorrect: boolean
    status: 'matched' | 'fuzzy' | 'new' | 'error'
    originalDiscipline?: string
    originalSubdiscipline?: string
    originalTopic?: string
}

interface TaxonomyData {
    disciplines: { id: number; name: string }[]
    subdisciplines: { id: number; name: string; discipline_id: number | null }[]
    topics: { id: number; name: string; subdiscipline_id: number | null }[]
}

interface SubmitProgress {
    phase: string
    current: number
    total: number
}

// ── Helpers: String Similarity ──

function diceCoefficient(s1: string, s2: string): number {
    s1 = s1.toLowerCase().trim()
    s2 = s2.toLowerCase().trim()
    if (s1 === s2) return 1
    if (s1.length < 2 || s2.length < 2) return 0

    const bigrams1 = new Map<string, number>()
    for (let i = 0; i < s1.length - 1; i++) {
        const bigram = s1.substring(i, i + 2)
        bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1)
    }

    let intersection = 0
    for (let i = 0; i < s2.length - 1; i++) {
        const bigram = s2.substring(i, i + 2)
        if (bigrams1.get(bigram)) {
            intersection++
            bigrams1.set(bigram, bigrams1.get(bigram)! - 1)
        }
    }

    return (2 * intersection) / (s1.length + s2.length - 2)
}

function findBestMatch<T extends { id: number; name: string }>(
    query: string,
    items: T[],
    threshold = 0.6
): { match: T | null; similarity: number } {
    if (!query) return { match: null, similarity: 0 }

    let bestMatch: T | null = null
    let maxSimilarity = 0

    for (const item of items) {
        const sim = diceCoefficient(query, item.name)
        if (sim > maxSimilarity) {
            maxSimilarity = sim
            bestMatch = item
        }
    }

    if (maxSimilarity >= threshold) {
        return { match: bestMatch, similarity: maxSimilarity }
    }

    return { match: null, similarity: maxSimilarity }
}

// ── Component ──

export default function ExamWizard() {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [submitProgress, setSubmitProgress] = useState<SubmitProgress | null>(null)

    // Taxonomy Cache
    const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null)

    // Step 1: form
    const [title, setTitle] = useState('')
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [boardId, setBoardId] = useState<string>('')
    const [boards, setBoards] = useState<{ id: number; name: string }[]>([])
    const [jsonInput, setJsonInput] = useState('')

    // Step 2: data
    const [questions, setQuestions] = useState<LoggedQuestion[]>([])

    const supabase = createClient()

    useEffect(() => {
        if (open && !taxonomy) {
            fetchTaxonomy()
        }
    }, [open])

    async function fetchTaxonomy() {
        setLoading(true)
        try {
            const [d, s, t, b] = await Promise.all([
                supabase.from('disciplines').select('id, name'),
                supabase.from('subdisciplines').select('id, name, discipline_id'),
                supabase.from('topics').select('id, name, subdiscipline_id'),
                supabase.from('exam_boards').select('id, name').order('name')
            ])

            if (d.error) throw d.error
            if (s.error) throw s.error
            if (t.error) throw t.error

            setTaxonomy({
                disciplines: d.data || [],
                subdisciplines: s.data || [],
                topics: t.data || []
            })
            setBoards(b.data || [])
        } catch (error) {
            console.error('Error fetching taxonomy:', error)
            toast.error('Erro ao carregar disciplinas.')
        } finally {
            setLoading(false)
        }
    }

    // ── Step 1 → 2: Parse JSON ──

    function handleParseJson() {
        if (!jsonInput.trim()) {
            toast.error('Cole o JSON primeiro.')
            return
        }
        if (!taxonomy) return

        setProcessing(true)

        setTimeout(() => {
            try {
                const parsed = JSON.parse(jsonInput) as JsonQuestion[]
                if (!Array.isArray(parsed)) throw new Error('O JSON deve ser uma lista []')

                const processed: LoggedQuestion[] = parsed.map((item, index) => {
                    const dMatch = findBestMatch(item.disciplina, taxonomy.disciplines)
                    const disciplineStatus: LoggedQuestion['status'] = dMatch.similarity === 1 ? 'matched' : (dMatch.match ? 'fuzzy' : 'new')

                    let subList = taxonomy.subdisciplines
                    if (dMatch.match) {
                        subList = subList.filter(s => s.discipline_id === dMatch.match!.id)
                    }
                    const sMatch = findBestMatch(item.subdisciplina, subList)
                    const subStatus: LoggedQuestion['status'] = sMatch.similarity === 1 ? 'matched' : (sMatch.match ? 'fuzzy' : 'new')

                    let topicList = taxonomy.topics
                    if (sMatch.match) {
                        topicList = topicList.filter(t => t.subdiscipline_id === sMatch.match!.id)
                    }
                    const tMatch = findBestMatch(item.assunto, topicList)
                    const topicStatus: LoggedQuestion['status'] = tMatch.similarity === 1 ? 'matched' : (tMatch.match ? 'fuzzy' : 'new')

                    let overallStatus: LoggedQuestion['status'] = 'matched'
                    if (disciplineStatus === 'new' || subStatus === 'new' || topicStatus === 'new') overallStatus = 'new'
                    else if (disciplineStatus === 'fuzzy' || subStatus === 'fuzzy' || topicStatus === 'fuzzy') overallStatus = 'fuzzy'

                    return {
                        id: index,
                        disciplineId: dMatch.match?.id,
                        disciplineName: dMatch.match?.name || item.disciplina,
                        originalDiscipline: item.disciplina,
                        subdisciplineId: sMatch.match?.id,
                        subdisciplineName: sMatch.match?.name || item.subdisciplina,
                        originalSubdiscipline: item.subdisciplina,
                        topicId: tMatch.match?.id,
                        topicName: tMatch.match?.name || item.assunto,
                        originalTopic: item.assunto,
                        isCorrect: true,
                        status: overallStatus
                    }
                })

                setQuestions(processed)
                setStep(2)
            } catch (e) {
                console.error(e)
                toast.error('JSON inválido. Verifique o formato.')
            } finally {
                setProcessing(false)
            }
        }, 300)
    }

    // ── Match Correction Handlers ──

    function handleMatchChange(
        questionId: number,
        field: 'discipline' | 'subdiscipline' | 'topic',
        value: string
    ) {
        if (!taxonomy) return

        setQuestions(qs => qs.map(q => {
            if (q.id !== questionId) return q

            const updated = { ...q }

            if (field === 'discipline') {
                if (value === 'new') {
                    updated.disciplineId = undefined
                    updated.disciplineName = q.originalDiscipline || q.disciplineName
                    updated.subdisciplineId = undefined
                    updated.subdisciplineName = q.originalSubdiscipline || q.subdisciplineName
                    updated.topicId = undefined
                    updated.topicName = q.originalTopic || q.topicName
                } else {
                    const disc = taxonomy.disciplines.find(d => d.id === Number(value))
                    if (disc) {
                        updated.disciplineId = disc.id
                        updated.disciplineName = disc.name
                        // Re-match subdiscipline under new discipline
                        const subList = taxonomy.subdisciplines.filter(s => s.discipline_id === disc.id)
                        const sMatch = findBestMatch(q.originalSubdiscipline || q.subdisciplineName, subList)
                        updated.subdisciplineId = sMatch.match?.id
                        updated.subdisciplineName = sMatch.match?.name || q.originalSubdiscipline || q.subdisciplineName
                        // Re-match topic under new subdiscipline
                        if (sMatch.match) {
                            const topicList = taxonomy.topics.filter(t => t.subdiscipline_id === sMatch.match!.id)
                            const tMatch = findBestMatch(q.originalTopic || q.topicName, topicList)
                            updated.topicId = tMatch.match?.id
                            updated.topicName = tMatch.match?.name || q.originalTopic || q.topicName
                        } else {
                            updated.topicId = undefined
                            updated.topicName = q.originalTopic || q.topicName
                        }
                    }
                }
            } else if (field === 'subdiscipline') {
                if (value === 'new') {
                    updated.subdisciplineId = undefined
                    updated.subdisciplineName = q.originalSubdiscipline || q.subdisciplineName
                    updated.topicId = undefined
                    updated.topicName = q.originalTopic || q.topicName
                } else {
                    const sub = taxonomy.subdisciplines.find(s => s.id === Number(value))
                    if (sub) {
                        updated.subdisciplineId = sub.id
                        updated.subdisciplineName = sub.name
                        // Re-match topic under new subdiscipline
                        const topicList = taxonomy.topics.filter(t => t.subdiscipline_id === sub.id)
                        const tMatch = findBestMatch(q.originalTopic || q.topicName, topicList)
                        updated.topicId = tMatch.match?.id
                        updated.topicName = tMatch.match?.name || q.originalTopic || q.topicName
                    }
                }
            } else if (field === 'topic') {
                if (value === 'new') {
                    updated.topicId = undefined
                    updated.topicName = q.originalTopic || q.topicName
                } else {
                    const topic = taxonomy.topics.find(t => t.id === Number(value))
                    if (topic) {
                        updated.topicId = topic.id
                        updated.topicName = topic.name
                    }
                }
            }

            // Recalculate status
            if (updated.disciplineId && updated.subdisciplineId && updated.topicId) {
                updated.status = 'matched'
            } else if (updated.disciplineId) {
                updated.status = updated.subdisciplineId || updated.topicId ? 'fuzzy' : 'new'
            } else {
                updated.status = 'new'
            }

            return updated
        }))
    }

    // ── Submit with Progress + Rollback ──

    async function handleSubmit() {
        if (!questions.length) return
        setSubmitting(true)
        setSubmitProgress({ phase: 'Preparando...', current: 0, total: 5 })

        let examId: string | null = null
        const insertedLogIds: string[] = []

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not found')

            // ── Phase 1: Auto-create missing taxonomy ──
            const needsCreation = questions.filter(q => !q.disciplineId || !q.subdisciplineId || !q.topicId)
            const totalToCreate = needsCreation.length

            if (totalToCreate > 0) {
                setSubmitProgress({ phase: `Criando taxonomia... (0/${totalToCreate})`, current: 0, total: totalToCreate })

                const discCache = new Map<string, number>()
                const subCache = new Map<string, number>()
                const topicCache = new Map<string, number>()

                if (taxonomy) {
                    taxonomy.disciplines.forEach(d => discCache.set(d.name.toLowerCase(), d.id))
                    taxonomy.subdisciplines.forEach(s => subCache.set(`${s.discipline_id}:${s.name.toLowerCase()}`, s.id))
                    taxonomy.topics.forEach(t => topicCache.set(`${t.subdiscipline_id}:${t.name.toLowerCase()}`, t.id))
                }

                async function getOrCreateDiscipline(name: string): Promise<number> {
                    const { data: existing } = await supabase
                        .from('disciplines').select('id').eq('name', name).maybeSingle()
                    if (existing) return existing.id
                    const { data: result, error } = await supabase
                        .from('disciplines').insert({ name }).select('id').single()
                    if (error) throw new Error(`Erro ao criar disciplina: ${error.message}`)
                    return result.id
                }

                async function getOrCreateSubdiscipline(name: string, discipline_id: number): Promise<number> {
                    const { data: existing } = await supabase
                        .from('subdisciplines').select('id').eq('name', name).eq('discipline_id', discipline_id).maybeSingle()
                    if (existing) return existing.id
                    const { data: result, error } = await supabase
                        .from('subdisciplines').insert({ name, discipline_id }).select('id').single()
                    if (error) throw new Error(`Erro ao criar subdisciplina: ${error.message}`)
                    return result.id
                }

                async function getOrCreateTopic(name: string, subdiscipline_id: number): Promise<number> {
                    const { data: existing } = await supabase
                        .from('topics').select('id').eq('name', name).eq('subdiscipline_id', subdiscipline_id).maybeSingle()
                    if (existing) return existing.id
                    const { data: result, error } = await supabase
                        .from('topics').insert({ name, subdiscipline_id }).select('id').single()
                    if (error) throw new Error(`Erro ao criar assunto: ${error.message}`)
                    return result.id
                }

                let created = 0
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i]
                    let dId = q.disciplineId
                    let sId = q.subdisciplineId
                    let tId = q.topicId

                    if (!dId) {
                        const dName = q.originalDiscipline || q.disciplineName
                        const key = dName.toLowerCase().trim()
                        if (discCache.has(key)) {
                            dId = discCache.get(key)!
                        } else {
                            dId = await getOrCreateDiscipline(dName.trim())
                            discCache.set(key, dId)
                        }
                    }

                    if (!sId && dId) {
                        const sName = q.originalSubdiscipline || q.subdisciplineName
                        if (sName && sName !== 'N/A') {
                            const key = `${dId}:${sName.toLowerCase().trim()}`
                            if (subCache.has(key)) {
                                sId = subCache.get(key)!
                            } else {
                                sId = await getOrCreateSubdiscipline(sName.trim(), dId)
                                subCache.set(key, sId)
                            }
                        }
                    }

                    if (!tId && sId) {
                        const tName = q.originalTopic || q.topicName
                        if (tName && tName !== 'N/A') {
                            const key = `${sId}:${tName.toLowerCase().trim()}`
                            if (topicCache.has(key)) {
                                tId = topicCache.get(key)!
                            } else {
                                tId = await getOrCreateTopic(tName.trim(), sId)
                                topicCache.set(key, tId)
                            }
                        }
                    }

                    questions[i] = { ...q, disciplineId: dId, subdisciplineId: sId, topicId: tId }

                    if (!q.disciplineId || !q.subdisciplineId || !q.topicId) {
                        created++
                        setSubmitProgress({ phase: `Criando taxonomia... (${created}/${totalToCreate})`, current: created, total: totalToCreate })
                    }
                }
            }

            // ── Phase 2: Create Exam ──
            const examTitle = title || `Simulado Importado ${format(new Date(), 'dd/MM')}`
            setSubmitProgress({ phase: 'Criando registro do simulado...', current: 1, total: 4 })

            const { data: exam, error: examError } = await supabase
                .from('exams')
                .insert({
                    user_id: user.id,
                    title: examTitle,
                    date: date,
                    year: new Date(date).getFullYear(),
                    board_id: boardId ? Number(boardId) : null
                })
                .select()
                .single()

            if (examError) throw examError
            examId = exam.id

            // ── Phase 3: Insert Question Logs ──
            setSubmitProgress({ phase: `Salvando ${questions.length} questões...`, current: 2, total: 4 })

            const logsToInsert = questions
                .filter(q => q.disciplineId)
                .map(q => ({
                    user_id: user.id,
                    date: date,
                    questions_done: 1,
                    correct_answers: q.isCorrect ? 1 : 0,
                    discipline_id: q.disciplineId,
                    subdiscipline_id: q.subdisciplineId || null,
                    topic_id: q.topicId || null,
                    source: `Simulado: ${exam.title}`
                }))

            if (logsToInsert.length > 0) {
                const { data: insertedLogs, error: logsError } = await supabase
                    .from('question_logs')
                    .insert(logsToInsert)
                    .select('id')

                if (logsError) throw logsError
                if (insertedLogs) insertedLogs.forEach(l => insertedLogIds.push(l.id))
            }

            // ── Phase 4: Aggregate & Insert Exam Scores ──
            setSubmitProgress({ phase: 'Registrando notas por disciplina...', current: 3, total: 4 })

            const scoreMap: Record<number, { total: number, correct: number }> = {}
            questions.forEach(q => {
                if (q.disciplineId) {
                    if (!scoreMap[q.disciplineId]) scoreMap[q.disciplineId] = { total: 0, correct: 0 }
                    scoreMap[q.disciplineId].total += 1
                    if (q.isCorrect) scoreMap[q.disciplineId].correct += 1
                }
            })

            const scoresToInsert = Object.entries(scoreMap).map(([dId, stats]) => ({
                exam_id: exam.id,
                discipline_id: Number(dId),
                questions_total: stats.total,
                questions_correct: stats.correct
            }))

            if (scoresToInsert.length > 0) {
                const { error: scoresError } = await supabase
                    .from('exam_scores')
                    .insert(scoresToInsert)

                if (scoresError) throw scoresError
            }

            // ── Done ──
            setSubmitProgress({ phase: 'Finalizado! ✅', current: 4, total: 4 })
            await new Promise(r => setTimeout(r, 600))

            toast.success(`Simulado salvo! ${questions.length} questões registradas.`)
            setOpen(false)
            setStep(1)
            setTitle('')
            setJsonInput('')
            setQuestions([])
            setSubmitProgress(null)
            window.location.reload()

        } catch (error) {
            console.error('Submit error:', error)

            // ── Rollback ──
            try {
                if (insertedLogIds.length > 0) {
                    await supabase.from('question_logs').delete().in('id', insertedLogIds)
                }
                if (examId) {
                    await supabase.from('exam_scores').delete().eq('exam_id', examId)
                    await supabase.from('exams').delete().eq('id', examId)
                }
                console.log('Rollback completed successfully')
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError)
            }

            toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        } finally {
            setSubmitting(false)
            setSubmitProgress(null)
        }
    }

    // ── Computed Values ──

    const correctCount = questions.filter(q => q.isCorrect).length
    const scorePercentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0

    const summary = useMemo(() => {
        const matchedCount = questions.filter(q => q.status === 'matched').length
        const fuzzyCount = questions.filter(q => q.status === 'fuzzy').length
        const newCount = questions.filter(q => q.status === 'new').length
        const errorCount = questions.filter(q => q.status === 'error').length

        // By discipline
        const byDiscipline: Record<string, { total: number; correct: number }> = {}
        questions.forEach(q => {
            const dName = q.disciplineName || 'Sem disciplina'
            if (!byDiscipline[dName]) byDiscipline[dName] = { total: 0, correct: 0 }
            byDiscipline[dName].total += 1
            if (q.isCorrect) byDiscipline[dName].correct += 1
        })

        const disciplines = Object.entries(byDiscipline)
            .map(([name, stats]) => ({
                name,
                total: stats.total,
                correct: stats.correct,
                accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total)

        return { matchedCount, fuzzyCount, newCount, errorCount, disciplines }
    }, [questions])

    // Helper: get filtered subdisciplines for a discipline ID
    function getSubsForDiscipline(discId?: number) {
        if (!taxonomy || !discId) return taxonomy?.subdisciplines || []
        return taxonomy.subdisciplines.filter(s => s.discipline_id === discId)
    }

    function getTopicsForSub(subId?: number) {
        if (!taxonomy || !subId) return taxonomy?.topics || []
        return taxonomy.topics.filter(t => t.subdiscipline_id === subId)
    }

    // ── Render ──

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileJson className="w-4 h-4" />
                    Registrar com JSON
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Registrar Simulado (Massa)</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Progress Stepper */}
                    <div className="flex items-center gap-3 text-sm text-zinc-500 mb-6">
                        <span className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                            step === 1 ? "bg-indigo-500/20 text-indigo-400 font-bold ring-1 ring-indigo-500/30" :
                                step > 1 ? "text-green-400" : ""
                        )}>
                            {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                            1. JSON
                        </span>
                        <ChevronRight className="w-4 h-4" />
                        <span className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                            step === 2 ? "bg-indigo-500/20 text-indigo-400 font-bold ring-1 ring-indigo-500/30" :
                                step > 2 ? "text-green-400" : ""
                        )}>
                            {step > 2 ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                            2. Gabarito
                        </span>
                        <ChevronRight className="w-4 h-4" />
                        <span className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                            step === 3 ? "bg-indigo-500/20 text-indigo-400 font-bold ring-1 ring-indigo-500/30" : ""
                        )}>
                            3. Resumo
                        </span>
                    </div>

                    {/* ═══════════════ STEP 1: JSON Input ═══════════════ */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Título do Simulado</Label>
                                    <Input
                                        placeholder="Ex: Simulado Nacional 2025"
                                        value={title}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                                        className="bg-zinc-900 border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Data de Realização</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                                        className="bg-zinc-900 border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Banca</Label>
                                    <select
                                        value={boardId}
                                        onChange={(e) => setBoardId(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    >
                                        <option value="">Selecione a banca</option>
                                        {boards.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex justify-between">
                                    <span>Cole o JSON das questões aqui</span>
                                    <span className="text-xs text-zinc-500">Formato: {`[{"disciplina": "...", ...}]`}</span>
                                </Label>
                                <Textarea
                                    value={jsonInput}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonInput(e.target.value)}
                                    placeholder='[ { "disciplina": "Cardiologia", "subdisciplina": "Arritmias", "assunto": "FA" }, ... ]'
                                    className="font-mono text-xs h-64 bg-zinc-900 border-zinc-700"
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleParseJson} disabled={loading || processing}>
                                    {loading || processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {processing ? 'Analisando e Cruzando Dados...' : 'Processar JSON e Avançar'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════ STEP 2: Gabarito + Match Correction ═══════════════ */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            {/* Quick Stats Header */}
                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-zinc-500">Total</div>
                                    <div className="text-2xl font-bold">{questions.length}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-zinc-500">Acertos</div>
                                    <div className="text-2xl font-bold text-green-400">{correctCount}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-zinc-500">Nota</div>
                                    <div className="text-2xl font-bold text-indigo-400">{scorePercentage.toFixed(1)}%</div>
                                </div>
                                <div className="flex gap-2">
                                    {summary.matchedCount > 0 && (
                                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                            {summary.matchedCount} ✓
                                        </span>
                                    )}
                                    {summary.fuzzyCount > 0 && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full">
                                            {summary.fuzzyCount} ≈
                                        </span>
                                    )}
                                    {summary.newCount > 0 && (
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                            {summary.newCount} +
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Questions List */}
                            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                {questions.map((q, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "p-3 rounded-lg border transition-colors",
                                            q.status === 'error' && "border-red-500/50 bg-red-500/10",
                                            q.status === 'fuzzy' && "border-yellow-500/50 bg-yellow-500/10",
                                            q.status === 'new' && "border-blue-500/50 bg-blue-500/10",
                                            q.status === 'matched' && "border-zinc-800 bg-zinc-900/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-zinc-500">Q{idx + 1}</span>
                                                    {q.status === 'matched' && (
                                                        <span className="text-xs text-green-400 flex items-center gap-1 font-medium">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                    {q.status === 'fuzzy' && (
                                                        <span className="text-xs text-yellow-500 flex items-center gap-1 font-medium">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Aproximado
                                                        </span>
                                                    )}
                                                    {q.status === 'new' && (
                                                        <span className="text-xs text-blue-400 flex items-center gap-1 font-medium">
                                                            <Plus className="w-3 h-3" />
                                                            Novo Item
                                                        </span>
                                                    )}
                                                    {q.status === 'error' && (
                                                        <span className="text-xs text-red-400 flex items-center gap-1 font-medium">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Erro
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Matched: plain text */}
                                                {q.status === 'matched' && (
                                                    <>
                                                        <div className="text-sm font-medium text-zinc-200">{q.topicName}</div>
                                                        <div className="text-xs text-zinc-500">{q.disciplineName} • {q.subdisciplineName}</div>
                                                    </>
                                                )}

                                                {/* Fuzzy or New: editable selects */}
                                                {(q.status === 'fuzzy' || q.status === 'new') && (
                                                    <div className="grid grid-cols-3 gap-2 mt-1">
                                                        {/* Discipline Select */}
                                                        <div>
                                                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Disciplina</label>
                                                            <select
                                                                value={q.disciplineId?.toString() || 'new'}
                                                                onChange={(e) => handleMatchChange(q.id, 'discipline', e.target.value)}
                                                                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 mt-0.5"
                                                            >
                                                                <option value="new">➕ Criar: &quot;{q.originalDiscipline}&quot;</option>
                                                                {taxonomy?.disciplines.map(d => (
                                                                    <option key={d.id} value={d.id.toString()}>{d.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Subdiscipline Select */}
                                                        <div>
                                                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Subdisciplina</label>
                                                            <select
                                                                value={q.subdisciplineId?.toString() || 'new'}
                                                                onChange={(e) => handleMatchChange(q.id, 'subdiscipline', e.target.value)}
                                                                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 mt-0.5"
                                                            >
                                                                <option value="new">➕ Criar: &quot;{q.originalSubdiscipline}&quot;</option>
                                                                {getSubsForDiscipline(q.disciplineId).map(s => (
                                                                    <option key={s.id} value={s.id.toString()}>{s.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Topic Select */}
                                                        <div>
                                                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Assunto</label>
                                                            <select
                                                                value={q.topicId?.toString() || 'new'}
                                                                onChange={(e) => handleMatchChange(q.id, 'topic', e.target.value)}
                                                                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 mt-0.5"
                                                            >
                                                                <option value="new">➕ Criar: &quot;{q.originalTopic}&quot;</option>
                                                                {getTopicsForSub(q.subdisciplineId).map(t => (
                                                                    <option key={t.id} value={t.id.toString()}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Correct/Wrong Toggle */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => setQuestions(qs => qs.map(item => item.id === q.id ? { ...item, isCorrect: true } : item))}
                                                    className={cn(
                                                        "p-2 rounded-md transition-all",
                                                        q.isCorrect ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                                                    )}
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setQuestions(qs => qs.map(item => item.id === q.id ? { ...item, isCorrect: false } : item))}
                                                    className={cn(
                                                        "p-2 rounded-md transition-all",
                                                        !q.isCorrect ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                                                    )}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-4 border-t border-zinc-800">
                                <Button variant="ghost" onClick={() => setStep(1)}>
                                    Voltar
                                </Button>
                                <Button onClick={() => setStep(3)}>
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    Ver Resumo e Salvar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════ STEP 3: Summary + Submit ═══════════════ */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            {/* Status Breakdown Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-green-400">{summary.matchedCount}</div>
                                    <div className="text-xs text-green-400/70 mt-1">✓ Encontrados</div>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-yellow-500">{summary.fuzzyCount}</div>
                                    <div className="text-xs text-yellow-500/70 mt-1">≈ Aproximados</div>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-blue-400">{summary.newCount}</div>
                                    <div className="text-xs text-blue-400/70 mt-1">+ Serão Criados</div>
                                </div>
                            </div>

                            {/* Score Card */}
                            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-white">📊 Nota Estimada</h3>
                                    <div className="text-3xl font-bold">
                                        <span className="text-green-400">{correctCount}</span>
                                        <span className="text-zinc-600">/{questions.length}</span>
                                        <span className={cn(
                                            "ml-3 text-2xl",
                                            scorePercentage >= 70 ? "text-green-400" :
                                                scorePercentage >= 50 ? "text-yellow-500" : "text-red-400"
                                        )}>
                                            ({scorePercentage.toFixed(1)}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Progress bar for score */}
                                <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            scorePercentage >= 70 ? "bg-gradient-to-r from-green-500 to-emerald-400" :
                                                scorePercentage >= 50 ? "bg-gradient-to-r from-yellow-500 to-amber-400" :
                                                    "bg-gradient-to-r from-red-500 to-rose-400"
                                        )}
                                        style={{ width: `${scorePercentage}%` }}
                                    />
                                </div>
                            </div>

                            {/* Discipline Breakdown Table */}
                            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                                <div className="px-4 py-3 border-b border-zinc-800">
                                    <h3 className="font-semibold text-white text-sm">📋 Desempenho por Disciplina</h3>
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-800/50">
                                            <th className="text-left py-2 px-4 text-xs text-zinc-500 font-medium">Disciplina</th>
                                            <th className="text-center py-2 px-4 text-xs text-zinc-500 font-medium">Questões</th>
                                            <th className="text-center py-2 px-4 text-xs text-zinc-500 font-medium">Acertos</th>
                                            <th className="text-right py-2 px-4 text-xs text-zinc-500 font-medium">Taxa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.disciplines.map((d, i) => (
                                            <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                                                <td className="py-2 px-4 text-zinc-200">{d.name}</td>
                                                <td className="py-2 px-4 text-center text-zinc-400">{d.total}</td>
                                                <td className="py-2 px-4 text-center text-zinc-400">{d.correct}</td>
                                                <td className="py-2 px-4 text-right">
                                                    <span className={cn(
                                                        "font-medium",
                                                        d.accuracy >= 70 ? "text-green-400" :
                                                            d.accuracy >= 50 ? "text-yellow-500" : "text-red-400"
                                                    )}>
                                                        {d.accuracy.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Submit Progress Bar (shown during submission) */}
                            {submitProgress && (
                                <div className="bg-zinc-900/80 rounded-xl border border-indigo-500/30 p-4 space-y-3 animate-in fade-in">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-indigo-300 font-medium">{submitProgress.phase}</span>
                                        <span className="text-zinc-500 text-xs">
                                            {submitProgress.total > 0 ? `${Math.round((submitProgress.current / submitProgress.total) * 100)}%` : ''}
                                        </span>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                                            style={{ width: submitProgress.total > 0 ? `${(submitProgress.current / submitProgress.total) * 100}%` : '100%' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-between pt-4 border-t border-zinc-800">
                                <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                                    Voltar ao Gabarito
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    {submitting ? 'Salvando...' : 'Confirmar e Salvar Tudo'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
