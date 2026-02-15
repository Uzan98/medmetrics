'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, Save, Plus, Calendar, Zap } from 'lucide-react'
import { AddSubdisciplineModal, AddTopicModal } from '@/components/ui'
import { addDays, format } from 'date-fns'
import type { Discipline, Subdiscipline, Topic, ExamBoard } from '@/types/database'

import { Suspense } from 'react'

function RegistrarContent() {
    const [disciplines, setDisciplines] = useState<Discipline[]>([])
    const [subdisciplines, setSubdisciplines] = useState<Subdiscipline[]>([])
    const [filteredSubdisciplines, setFilteredSubdisciplines] = useState<Subdiscipline[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [filteredTopics, setFilteredTopics] = useState<Topic[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [duplicateWarning, setDuplicateWarning] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAddTopicModal, setShowAddTopicModal] = useState(false)

    // Estado para revisões
    const [showReviewOptions, setShowReviewOptions] = useState(false)
    const [savedLogId, setSavedLogId] = useState<string | null>(null)
    const [reviewMode, setReviewMode] = useState<'auto' | 'manual'>('auto')
    const [selectedReviews, setSelectedReviews] = useState({
        day1: true,
        day7: true,
        day30: true,
    })
    const [schedulingReviews, setSchedulingReviews] = useState(false)
    const searchParams = useSearchParams()

    const [form, setForm] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        disciplineId: '',
        subdisciplineId: '',
        topicId: '',
        source: '',
        questionsDone: '',
        correctAnswers: '',
        timeMinutes: '',
        notes: '',
    })

    // Estado para "Prova na Íntegra"
    const [registrationMode, setRegistrationMode] = useState<'single' | 'exam'>('single')
    const [boards, setBoards] = useState<ExamBoard[]>([])
    const [examForm, setExamForm] = useState({
        year: new Date().getFullYear().toString(),
        boardId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '',
        scores: {
            'Clínica Médica': { total: '', correct: '' },
            'Cirurgia': { total: '', correct: '' },
            'Ginecologia e Obstetrícia': { total: '', correct: '' },
            'Pediatria': { total: '', correct: '' },
            'Medicina Preventiva': { total: '', correct: '' },
        }
    })
    const [newBoardName, setNewBoardName] = useState('')
    const [showAddBoard, setShowAddBoard] = useState(false)
    const [creatingBoard, setCreatingBoard] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        loadData()
        loadBoards()
    }, [])

    useEffect(() => {
        if (form.disciplineId) {
            const filtered = subdisciplines.filter(
                (s) => s.discipline_id === Number(form.disciplineId)
            )
            setFilteredSubdisciplines(filtered)
        } else {
            setFilteredSubdisciplines([])
        }
    }, [form.disciplineId, subdisciplines])

    useEffect(() => {
        if (form.subdisciplineId) {
            const filtered = topics.filter(
                (t) => t.subdiscipline_id === Number(form.subdisciplineId)
            )
            setFilteredTopics(filtered)
        } else {
            setFilteredTopics([])
        }
    }, [form.subdisciplineId, topics])

    useEffect(() => {
        const disciplineId = searchParams.get('disciplineId')
        const subdisciplineId = searchParams.get('subdisciplineId')
        const topicId = searchParams.get('topicId')

        if (disciplineId) {
            setForm(prev => ({
                ...prev,
                disciplineId,
                subdisciplineId: subdisciplineId || '',
                topicId: topicId || ''
            }))
        }
    }, [searchParams])

    useEffect(() => {
        checkDuplicate()
    }, [form.date, form.disciplineId, form.subdisciplineId, form.topicId])


    // Atualiza revisões automáticas baseado na acurácia
    useEffect(() => {
        if (reviewMode === 'auto' && form.questionsDone && form.correctAnswers) {
            const acc = (Number(form.correctAnswers) / Number(form.questionsDone)) * 100
            if (acc < 60) {
                setSelectedReviews({ day1: true, day7: true, day30: true })
            } else if (acc < 80) {
                setSelectedReviews({ day1: false, day7: true, day30: true })
            } else {
                setSelectedReviews({ day1: false, day7: false, day30: true })
            }
        }
    }, [reviewMode, form.questionsDone, form.correctAnswers])

    async function loadData() {
        try {
            const [disciplinesRes, subdisciplinesRes, topicsRes] = await Promise.all([
                supabase.from('disciplines').select('*').order('name'),
                supabase.from('subdisciplines').select('*').order('name'),
                supabase.from('topics').select('*').order('name'),
            ])

            if (disciplinesRes.data) setDisciplines(disciplinesRes.data)
            if (subdisciplinesRes.data) setSubdisciplines(subdisciplinesRes.data)
            if (topicsRes.data) setTopics(topicsRes.data)
        } catch (err) {
            console.error('Error loading data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function loadBoards() {
        try {
            const { data } = await supabase
                .from('exam_boards')
                .select('*')
                .order('name')

            if (data) setBoards(data)
        } catch (err) {
            console.error('Error loading boards:', err)
        }
    }

    async function checkDuplicate() {
        if (!form.date || !form.disciplineId) {
            setDuplicateWarning(false)
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let query = supabase
                .from('question_logs')
                .select('id')
                .eq('user_id', user.id)
                .eq('date', form.date)
                .eq('discipline_id', Number(form.disciplineId))

            if (form.subdisciplineId) {
                query = query.eq('subdiscipline_id', Number(form.subdisciplineId))
            }

            if (form.topicId) {
                query = query.eq('topic_id', Number(form.topicId))
            }

            const { data } = await query

            setDuplicateWarning(data !== null && data.length > 0)
        } catch (err) {
            console.error('Error checking duplicate:', err)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccess(false)
        setSubmitting(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error('Usuário não autenticado')
            }

            const questionsDone = Number(form.questionsDone)
            const correctAnswers = Number(form.correctAnswers)

            if (correctAnswers > questionsDone) {
                throw new Error('O número de acertos não pode ser maior que o número de questões')
            }

            const { data: insertedLog, error: insertError } = await supabase
                .from('question_logs')
                .insert({
                    user_id: user.id,
                    date: form.date,
                    discipline_id: form.disciplineId ? Number(form.disciplineId) : null,
                    subdiscipline_id: form.subdisciplineId ? Number(form.subdisciplineId) : null,
                    topic_id: form.topicId ? Number(form.topicId) : null,
                    source: form.source || null,
                    questions_done: questionsDone,
                    correct_answers: correctAnswers,
                    time_minutes: form.timeMinutes ? Number(form.timeMinutes) : null,
                    notes: form.notes || null,
                })
                .select('id')
                .single()

            if (insertError) throw insertError

            setSuccess(true)
            setSavedLogId(insertedLog.id)
            setShowReviewOptions(true)
            setDuplicateWarning(false)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleCreateBoard() {
        if (!newBoardName.trim()) return
        setCreatingBoard(true)
        try {
            const { data, error } = await supabase
                .from('exam_boards')
                .insert({ name: newBoardName.trim() })
                .select()
                .single()

            if (error) throw error

            if (data) {
                setBoards(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
                setExamForm(prev => ({ ...prev, boardId: String(data.id) }))
                setShowAddBoard(false)
                setNewBoardName('')
            }
        } catch (err) {
            console.error('Error creating board:', err)
            setError('Erro ao criar banca. Verifique se já existe.')
        } finally {
            setCreatingBoard(false)
        }
    }

    async function handleExamSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccess(false)
        setSubmitting(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não autenticado')
            if (!examForm.boardId) throw new Error('Selecione uma banca')

            // 1. Create Exam
            const { data: exam, error: examError } = await supabase
                .from('exams')
                .insert({
                    user_id: user.id,
                    board_id: Number(examForm.boardId),
                    year: Number(examForm.year),
                    date: examForm.date,
                    title: examForm.title || null
                })
                .select()
                .single()

            if (examError) throw examError

            // 2. Prepare Scores
            // 2. Prepare Scores
            const scoresToInsert = []

            // Map form names to DB names or partial matches
            const disciplineMapping: { [key: string]: string } = {
                'Clínica Médica': 'Clínica Médica',
                'Cirurgia': 'Cirurgia Geral e Trauma',
                'Ginecologia e Obstetrícia': 'Ginecologia e Obstetrícia',
                'Pediatria': 'Pediatria',
                'Medicina Preventiva': 'Saúde Coletiva / Preventiva'
            }

            for (const [discName, scores] of Object.entries(examForm.scores)) {
                if (scores.total && scores.correct) {
                    const targetName = disciplineMapping[discName]
                    const disc = disciplines.find(d => d.name === targetName || d.name.includes(targetName) || targetName.includes(d.name))

                    if (disc) {
                        scoresToInsert.push({
                            exam_id: exam.id,
                            discipline_id: disc.id,
                            questions_total: Number(scores.total),
                            questions_correct: Number(scores.correct)
                        })
                    } else {
                        console.warn(`Disciplina não encontrada para: ${discName} (Target: ${targetName})`)
                    }
                }
            }

            if (scoresToInsert.length > 0) {
                const { error: scoresError } = await supabase
                    .from('exam_scores')
                    .insert(scoresToInsert)

                if (scoresError) throw scoresError
            }

            setSuccess(true)
            setExamForm({
                year: new Date().getFullYear().toString(),
                boardId: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                title: '',
                scores: {
                    'Clínica Médica': { total: '', correct: '' },
                    'Cirurgia': { total: '', correct: '' },
                    'Ginecologia e Obstetrícia': { total: '', correct: '' },
                    'Pediatria': { total: '', correct: '' },
                    'Medicina Preventiva': { total: '', correct: '' },
                }
            })

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar prova')
        } finally {
            setSubmitting(false)
        }
    }

    async function scheduleReviews() {
        if (!savedLogId) return

        setSchedulingReviews(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não autenticado')

            const baseDate = new Date(form.date + 'T12:00:00')
            const reviews = []

            if (selectedReviews.day1) {
                reviews.push({
                    user_id: user.id,
                    question_log_id: savedLogId,
                    discipline_id: form.disciplineId ? Number(form.disciplineId) : null,
                    subdiscipline_id: form.subdisciplineId ? Number(form.subdisciplineId) : null,
                    scheduled_date: format(addDays(baseDate, 1), 'yyyy-MM-dd'),
                    review_type: '1d' as const,
                })
            }

            if (selectedReviews.day7) {
                reviews.push({
                    user_id: user.id,
                    question_log_id: savedLogId,
                    discipline_id: form.disciplineId ? Number(form.disciplineId) : null,
                    subdiscipline_id: form.subdisciplineId ? Number(form.subdisciplineId) : null,
                    scheduled_date: format(addDays(baseDate, 7), 'yyyy-MM-dd'),
                    review_type: '7d' as const,
                })
            }

            if (selectedReviews.day30) {
                reviews.push({
                    user_id: user.id,
                    question_log_id: savedLogId,
                    discipline_id: form.disciplineId ? Number(form.disciplineId) : null,
                    subdiscipline_id: form.subdisciplineId ? Number(form.subdisciplineId) : null,
                    scheduled_date: format(addDays(baseDate, 30), 'yyyy-MM-dd'),
                    review_type: '30d' as const,
                })
            }

            if (reviews.length > 0) {
                const { error: reviewError } = await supabase
                    .from('scheduled_reviews')
                    .insert(reviews)

                if (reviewError) throw reviewError
            }

            // Resetar formulário
            resetForm()

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao agendar revisões')
        } finally {
            setSchedulingReviews(false)
        }
    }

    function skipReviews() {
        resetForm()
    }

    function resetForm() {
        setForm({
            date: format(new Date(), 'yyyy-MM-dd'),
            disciplineId: '',
            subdisciplineId: '',
            topicId: '',
            source: '',
            questionsDone: '',
            correctAnswers: '',
            timeMinutes: '',
            notes: '',
        })
        setShowReviewOptions(false)
        setSavedLogId(null)
        setSuccess(false)
        setSelectedReviews({ day1: true, day7: true, day30: true })
        setDuplicateWarning(false)
    }

    function handleSubdisciplineCreated(newSub: { id: number; name: string }) {
        const newSubdiscipline: Subdiscipline = {
            id: newSub.id,
            name: newSub.name,
            discipline_id: Number(form.disciplineId),
            created_at: new Date().toISOString(),
        }
        setSubdisciplines(prev => [...prev, newSubdiscipline])
        setForm(prev => ({ ...prev, subdisciplineId: String(newSub.id) }))
    }

    function handleTopicCreated(newTopic: { id: number; name: string }) {
        const newTopicEntry: Topic = {
            id: newTopic.id,
            name: newTopic.name,
            subdiscipline_id: Number(form.subdisciplineId),
            created_at: new Date().toISOString(),
        }
        setTopics(prev => [...prev, newTopicEntry])
        setForm(prev => ({ ...prev, topicId: String(newTopic.id) }))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    const errors = form.questionsDone && form.correctAnswers
        ? Number(form.questionsDone) - Number(form.correctAnswers)
        : null

    const accuracy =
        form.questionsDone && form.correctAnswers && Number(form.questionsDone) > 0
            ? ((Number(form.correctAnswers) / Number(form.questionsDone)) * 100).toFixed(1)
            : null

    // Tela de opções de revisão após salvar
    if (showReviewOptions) {
        return (
            <div className="max-w-2xl mx-auto animate-fade-in">
                <div className="bg-zinc-800/50 rounded-2xl p-8 border border-zinc-700/50">
                    {/* Success Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Registro salvo!</h2>
                            <p className="text-zinc-400">Deseja agendar revisões para este tema?</p>
                        </div>
                    </div>

                    {/* Review Mode Toggle */}
                    <div className="mb-6">
                        <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl">
                            <button
                                onClick={() => setReviewMode('auto')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${reviewMode === 'auto'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                <Zap className="w-4 h-4" />
                                Automático
                            </button>
                            <button
                                onClick={() => setReviewMode('manual')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${reviewMode === 'manual'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                <Calendar className="w-4 h-4" />
                                Manual
                            </button>
                        </div>
                        {reviewMode === 'auto' && accuracy && (
                            <p className="text-xs text-zinc-500 mt-2 text-center">
                                Com {accuracy}% de acerto, selecionamos: {
                                    Number(accuracy) < 60 ? 'todas as revisões' :
                                        Number(accuracy) < 80 ? '7 e 30 dias' : 'apenas 30 dias'
                                }
                            </p>
                        )}
                    </div>

                    {/* Review Options */}
                    <div className="space-y-3 mb-6">
                        <label className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${selectedReviews.day1
                            ? 'bg-blue-500/10 border-blue-500/50'
                            : 'bg-zinc-900/30 border-zinc-700/50 hover:border-zinc-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.day1}
                                    onChange={(e) => setSelectedReviews(prev => ({ ...prev, day1: e.target.checked }))}
                                    disabled={reviewMode === 'auto'}
                                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="font-medium text-white">Revisão em 1 dia</p>
                                    <p className="text-xs text-zinc-500">
                                        {format(addDays(new Date(form.date), 1), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-zinc-500">Fixação inicial</span>
                        </label>

                        <label className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${selectedReviews.day7
                            ? 'bg-purple-500/10 border-purple-500/50'
                            : 'bg-zinc-900/30 border-zinc-700/50 hover:border-zinc-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.day7}
                                    onChange={(e) => setSelectedReviews(prev => ({ ...prev, day7: e.target.checked }))}
                                    disabled={reviewMode === 'auto'}
                                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                                />
                                <div>
                                    <p className="font-medium text-white">Revisão em 7 dias</p>
                                    <p className="text-xs text-zinc-500">
                                        {format(addDays(new Date(form.date), 7), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-zinc-500">Consolidação</span>
                        </label>

                        <label className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${selectedReviews.day30
                            ? 'bg-green-500/10 border-green-500/50'
                            : 'bg-zinc-900/30 border-zinc-700/50 hover:border-zinc-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.day30}
                                    onChange={(e) => setSelectedReviews(prev => ({ ...prev, day30: e.target.checked }))}
                                    disabled={reviewMode === 'auto'}
                                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500"
                                />
                                <div>
                                    <p className="font-medium text-white">Revisão em 30 dias</p>
                                    <p className="text-xs text-zinc-500">
                                        {format(addDays(new Date(form.date), 30), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-zinc-500">Memória longo prazo</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={skipReviews}
                            className="flex-1 py-3 px-4 rounded-xl font-medium text-zinc-400 bg-zinc-900/50 hover:bg-zinc-800 transition-colors"
                        >
                            Pular
                        </button>
                        <button
                            onClick={scheduleReviews}
                            disabled={schedulingReviews || (!selectedReviews.day1 && !selectedReviews.day7 && !selectedReviews.day30)}
                            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02]"
                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                        >
                            {schedulingReviews ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Calendar className="w-5 h-5" />
                                    Agendar Revisões
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const selectedDiscipline = disciplines.find(d => d.id === Number(form.disciplineId))
    const selectedSubdiscipline = subdisciplines.find(s => s.id === Number(form.subdisciplineId))



    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Registrar</h1>
                    <p className="text-zinc-400">Adicione suas questões ou provas completas</p>
                </div >

                <div className="bg-zinc-800/50 p-1 rounded-xl flex gap-1 border border-zinc-700/50">
                    <button
                        onClick={() => setRegistrationMode('single')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${registrationMode === 'single'
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                            }`}
                    >
                        Questões Avulsas
                    </button>
                    <button
                        onClick={() => setRegistrationMode('exam')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${registrationMode === 'exam'
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                            }`}
                    >
                        Prova na Íntegra
                    </button>
                </div>
            </div >

            {success && (
                <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-green-400">Registro salvo com sucesso!</span>
                </div>
            )
            }

            {
                error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-fade-in">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <span className="text-red-400">{error}</span>
                    </div>
                )
            }

            {
                registrationMode === 'exam' ? (
                    <form onSubmit={handleExamSubmit} className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700/50 space-y-6 animate-fade-in shadow-xl shadow-black/10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Banca</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={examForm.boardId}
                                            onChange={(e) => setExamForm({ ...examForm, boardId: e.target.value })}
                                            className="w-full pl-4 pr-10 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                                            required
                                        >
                                            <option value="">Selecione a banca...</option>
                                            {boards.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddBoard(!showAddBoard)}
                                        className={`px-3 py-3 rounded-xl border transition-all ${showAddBoard
                                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                                            : 'bg-zinc-900 border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600'
                                            }`}
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>

                                {showAddBoard && (
                                    <div className="mt-2 flex gap-2 animate-in slide-in-from-top-2 fade-in">
                                        <input
                                            type="text"
                                            value={newBoardName}
                                            onChange={(e) => setNewBoardName(e.target.value)}
                                            placeholder="Nome da nova banca..."
                                            className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCreateBoard}
                                            disabled={creatingBoard || !newBoardName.trim()}
                                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
                                        >
                                            {creatingBoard ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ano</label>
                                <input
                                    type="number"
                                    min="2000"
                                    max={new Date().getFullYear() + 1}
                                    value={examForm.year}
                                    onChange={(e) => setExamForm({ ...examForm, year: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data Realizada</label>
                                <input
                                    type="date"
                                    value={examForm.date}
                                    onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-zinc-400 focus:text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Título (Opcional)</label>
                                <input
                                    type="text"
                                    value={examForm.title}
                                    onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                                    placeholder="Ex: Simulado Nacional 1"
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-5 pt-6 border-t border-zinc-700/50">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                                Notas por Grande Área
                            </h3>
                            <div className="space-y-3">
                                {Object.keys(examForm.scores).map((discName) => (
                                    <div key={discName} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                        <div className="w-full sm:w-48">
                                            <span className="text-sm font-medium text-zinc-300">{discName}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={examForm.scores[discName as keyof typeof examForm.scores].total}
                                                    onChange={(e) => {
                                                        const newScores = { ...examForm.scores }
                                                        newScores[discName as keyof typeof examForm.scores].total = e.target.value
                                                        setExamForm({ ...examForm, scores: newScores })
                                                    }}
                                                    className="w-full pl-4 pr-12 py-2.5 bg-zinc-900 border border-zinc-700/50 rounded-lg text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-zinc-600"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 group-focus-within:text-indigo-400 transition-colors">Total</span>
                                            </div>
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={examForm.scores[discName as keyof typeof examForm.scores].correct}
                                                    onChange={(e) => {
                                                        const newScores = { ...examForm.scores }
                                                        newScores[discName as keyof typeof examForm.scores].correct = e.target.value
                                                        setExamForm({ ...examForm, scores: newScores })
                                                    }}
                                                    className="w-full pl-4 pr-12 py-2.5 bg-zinc-900 border border-zinc-700/50 rounded-lg text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-600"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 group-focus-within:text-emerald-400 transition-colors">Acertos</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full mt-6 py-4 px-6 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar Prova Completa
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700/50 shadow-xl shadow-black/10">
                        <div className="space-y-6">
                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-zinc-400 focus:text-white"
                                    required
                                />
                            </div>

                            {/* Discipline */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Disciplina</label>
                                <div className="relative">
                                    <select
                                        value={form.disciplineId}
                                        onChange={(e) => setForm({
                                            ...form,
                                            disciplineId: e.target.value,
                                            subdisciplineId: '',
                                            topicId: ''
                                        })}
                                        className="w-full pl-4 pr-10 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                                        required
                                    >
                                        <option value="">Selecione a disciplina...</option>
                                        {disciplines.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Subdiscipline */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Subdisciplina</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={form.subdisciplineId}
                                            onChange={(e) => setForm({
                                                ...form,
                                                subdisciplineId: e.target.value,
                                                topicId: ''
                                            })}
                                            className="w-full pl-4 pr-10 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white disabled:opacity-50 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                                            disabled={!form.disciplineId}
                                        >
                                            <option value="">Selecione...</option>
                                            {filteredSubdisciplines.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(true)}
                                        disabled={!form.disciplineId}
                                        className="px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Adicionar nova subdisciplina"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                {form.disciplineId && !filteredSubdisciplines.length && (
                                    <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1 animate-fade-in">
                                        <AlertCircle className="w-3 h-3" />
                                        Nenhuma subdisciplina encontrada. Adicione uma!
                                    </p>
                                )}
                            </div>

                            {/* Topic (Assunto) */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Assunto (Opcional)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={form.topicId}
                                            onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                                            className="w-full pl-4 pr-10 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white disabled:opacity-50 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                                            disabled={!form.subdisciplineId}
                                        >
                                            <option value="">Selecione...</option>
                                            {filteredTopics.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddTopicModal(true)}
                                        disabled={!form.subdisciplineId}
                                        className="px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Adicionar novo assunto"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Source */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    Fonte (banco, curso, etc.)
                                </label>
                                <input
                                    type="text"
                                    value={form.source}
                                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="Ex: Medcel, Estratégia, USP..."
                                />
                            </div>

                            {/* Questions and Answers */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Questões feitas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.questionsDone}
                                        onChange={(e) => setForm({ ...form, questionsDone: e.target.value })}
                                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                                        required
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Acertos</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={form.questionsDone || undefined}
                                        value={form.correctAnswers}
                                        onChange={(e) => setForm({ ...form, correctAnswers: e.target.value })}
                                        className={`w-full px-4 py-3 bg-zinc-900 border rounded-xl text-white outline-none focus:ring-1 transition-all placeholder-zinc-600 ${form.correctAnswers && form.questionsDone &&
                                            Number(form.correctAnswers) > Number(form.questionsDone)
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                            : 'border-zinc-700/50 focus:border-emerald-500 focus:ring-emerald-500'
                                            }`}
                                        required
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Stats preview */}
                            {errors !== null && (
                                <div className="grid grid-cols-2 gap-4 animate-in zoom-in-95 duration-200">
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                                        <p className="text-3xl font-bold text-white">{errors}</p>
                                        <p className="text-xs font-medium text-red-400 uppercase tracking-wider mt-1">Erros</p>
                                    </div>
                                    <div className={`p-4 rounded-xl border text-center ${Number(accuracy) >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' :
                                        Number(accuracy) >= 60 ? 'bg-yellow-500/10 border-yellow-500/20' :
                                            'bg-red-500/10 border-red-500/20'
                                        }`}>
                                        <p className={`text-3xl font-bold ${Number(accuracy) >= 80 ? 'text-emerald-400' :
                                            Number(accuracy) >= 60 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>{accuracy}%</p>
                                        <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${Number(accuracy) >= 80 ? 'text-emerald-400' :
                                            Number(accuracy) >= 60 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>Aproveitamento</p>
                                    </div>
                                </div>
                            )}

                            {/* Time */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    Tempo (minutos) - opcional
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.timeMinutes}
                                    onChange={(e) => setForm({ ...form, timeMinutes: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                                    placeholder="Ex: 60"
                                />
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    Observações - opcional
                                </label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 resize-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="Anotações sobre este bloco de estudo..."
                                />
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full mt-8 py-4 px-6 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar Registro
                                </>
                            )}
                        </button>
                    </form>
                )
            }

            {/* Modal para adicionar subdisciplina */}
            {
                selectedDiscipline && (
                    <AddSubdisciplineModal
                        isOpen={showAddModal}
                        onClose={() => setShowAddModal(false)}
                        disciplineId={Number(form.disciplineId)}
                        disciplineName={selectedDiscipline.name}
                        onCreated={handleSubdisciplineCreated}
                    />
                )
            }

            {/* Modal para adicionar assunto */}
            {
                selectedSubdiscipline && (
                    <AddTopicModal
                        isOpen={showAddTopicModal}
                        onClose={() => setShowAddTopicModal(false)}
                        subdisciplineId={Number(form.subdisciplineId)}
                        subdisciplineName={selectedSubdiscipline.name}
                        onCreated={handleTopicCreated}
                    />
                )
            }
        </div >
    )
}

export default function RegistrarPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        }>
            <RegistrarContent />
        </Suspense>
    )
}
