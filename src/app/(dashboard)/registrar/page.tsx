'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, Save, Plus, Calendar, Zap } from 'lucide-react'
import { AddSubdisciplineModal, AddTopicModal } from '@/components/ui'
import { addDays, format } from 'date-fns'
import type { Discipline, Subdiscipline, Topic } from '@/types/database'

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
        date: new Date().toISOString().split('T')[0],
        disciplineId: '',
        subdisciplineId: '',
        topicId: '',
        source: '',
        questionsDone: '',
        correctAnswers: '',
        timeMinutes: '',
        notes: '',
    })

    const supabase = createClient()

    useEffect(() => {
        loadData()
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

    async function scheduleReviews() {
        if (!savedLogId) return

        setSchedulingReviews(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não autenticado')

            const baseDate = new Date(form.date)
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
            date: new Date().toISOString().split('T')[0],
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

    const selectedDiscipline = disciplines.find(d => d.id === Number(form.disciplineId))
    const selectedSubdiscipline = subdisciplines.find(s => s.id === Number(form.subdisciplineId))

    const errors = form.questionsDone && form.correctAnswers
        ? Number(form.questionsDone) - Number(form.correctAnswers)
        : null

    const accuracy =
        form.questionsDone && form.correctAnswers && Number(form.questionsDone) > 0
            ? ((Number(form.correctAnswers) / Number(form.questionsDone)) * 100).toFixed(1)
            : null

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    // Tela de opções de revisão após salvar
    if (showReviewOptions) {
        return (
            <div className="max-w-2xl mx-auto animate-fade-in">
                <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
                    {/* Success Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Registro salvo!</h2>
                            <p className="text-slate-400">Deseja agendar revisões para este tema?</p>
                        </div>
                    </div>

                    {/* Review Mode Toggle */}
                    <div className="mb-6">
                        <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl">
                            <button
                                onClick={() => setReviewMode('auto')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${reviewMode === 'auto'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Zap className="w-4 h-4" />
                                Automático
                            </button>
                            <button
                                onClick={() => setReviewMode('manual')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${reviewMode === 'manual'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Calendar className="w-4 h-4" />
                                Manual
                            </button>
                        </div>
                        {reviewMode === 'auto' && accuracy && (
                            <p className="text-xs text-slate-500 mt-2 text-center">
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
                            : 'bg-slate-900/30 border-slate-700/50 hover:border-slate-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.day1}
                                    onChange={(e) => setSelectedReviews(prev => ({ ...prev, day1: e.target.checked }))}
                                    disabled={reviewMode === 'auto'}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="font-medium text-white">Revisão em 1 dia</p>
                                    <p className="text-xs text-slate-500">
                                        {format(addDays(new Date(form.date), 1), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500">Fixação inicial</span>
                        </label>

                        <label className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${selectedReviews.day7
                            ? 'bg-purple-500/10 border-purple-500/50'
                            : 'bg-slate-900/30 border-slate-700/50 hover:border-slate-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.day7}
                                    onChange={(e) => setSelectedReviews(prev => ({ ...prev, day7: e.target.checked }))}
                                    disabled={reviewMode === 'auto'}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                                />
                                <div>
                                    <p className="font-medium text-white">Revisão em 7 dias</p>
                                    <p className="text-xs text-slate-500">
                                        {format(addDays(new Date(form.date), 7), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500">Consolidação</span>
                        </label>

                        <label className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${selectedReviews.day30
                            ? 'bg-green-500/10 border-green-500/50'
                            : 'bg-slate-900/30 border-slate-700/50 hover:border-slate-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.day30}
                                    onChange={(e) => setSelectedReviews(prev => ({ ...prev, day30: e.target.checked }))}
                                    disabled={reviewMode === 'auto'}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500"
                                />
                                <div>
                                    <p className="font-medium text-white">Revisão em 30 dias</p>
                                    <p className="text-xs text-slate-500">
                                        {format(addDays(new Date(form.date), 30), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500">Memória longo prazo</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={skipReviews}
                            className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-400 bg-slate-900/50 hover:bg-slate-800 transition-colors"
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

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Registrar Questões</h1>
                <p className="text-slate-400">Adicione um novo registro de estudo</p>
            </div>

            {success && (
                <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-green-400">Registro salvo com sucesso!</span>
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400">{error}</span>
                </div>
            )}

            {duplicateWarning && (
                <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span className="text-yellow-400">
                        Já existe um registro para esta data e disciplina. Você pode continuar se quiser.
                    </span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <div className="space-y-5">
                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Data</label>
                        <input
                            type="date"
                            value={form.date}

                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                            required
                        />
                    </div>

                    {/* Discipline */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Disciplina</label>
                        <select
                            value={form.disciplineId}
                            onChange={(e) => setForm({
                                ...form,
                                disciplineId: e.target.value,
                                subdisciplineId: '',
                                topicId: ''
                            })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                            required
                        >
                            <option value="">Selecione...</option>
                            {disciplines.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subdiscipline */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Subdisciplina</label>
                        <div className="flex gap-2">
                            <select
                                value={form.subdisciplineId}
                                onChange={(e) => setForm({
                                    ...form,
                                    subdisciplineId: e.target.value,
                                    topicId: ''
                                })}
                                className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white disabled:opacity-50"
                                disabled={!form.disciplineId}
                            >
                                <option value="">Selecione...</option>
                                {filteredSubdisciplines.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                disabled={!form.disciplineId}
                                className="px-4 py-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Adicionar nova subdisciplina"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        {form.disciplineId && (
                            <p className="text-xs text-slate-500 mt-2">
                                Não encontrou? Clique no + para adicionar uma nova subdisciplina.
                            </p>
                        )}
                    </div>

                    {/* Topic (Assunto) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Assunto (Opcional)</label>
                        <div className="flex gap-2">
                            <select
                                value={form.topicId}
                                onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                                className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white disabled:opacity-50"
                                disabled={!form.subdisciplineId}
                            >
                                <option value="">Selecione...</option>
                                {filteredTopics.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowAddTopicModal(true)}
                                disabled={!form.subdisciplineId}
                                className="px-4 py-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Adicionar novo assunto"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        {form.subdisciplineId && (
                            <p className="text-xs text-slate-500 mt-2">
                                Refine seu estudo selecionando um assunto específico.
                            </p>
                        )}
                    </div>

                    {/* Source */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Fonte (banco, curso, etc.)
                        </label>
                        <input
                            type="text"
                            value={form.source}
                            onChange={(e) => setForm({ ...form, source: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500"
                            placeholder="Ex: Medcel, Estratégia, USP..."
                        />
                    </div>

                    {/* Questions and Answers */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Questões feitas</label>
                            <input
                                type="number"
                                min="1"
                                value={form.questionsDone}
                                onChange={(e) => setForm({ ...form, questionsDone: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Acertos</label>
                            <input
                                type="number"
                                min="0"
                                max={form.questionsDone || undefined}
                                value={form.correctAnswers}
                                onChange={(e) => setForm({ ...form, correctAnswers: e.target.value })}
                                className={`w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-white ${form.correctAnswers && form.questionsDone &&
                                    Number(form.correctAnswers) > Number(form.questionsDone)
                                    ? 'border-red-500'
                                    : 'border-slate-700'
                                    }`}
                                required
                            />
                        </div>
                    </div>

                    {/* Stats preview */}
                    {errors !== null && (
                        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/30">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-red-400">{errors}</p>
                                <p className="text-xs text-slate-500">erros</p>
                            </div>
                            <div className="text-center">
                                <p className={`text-2xl font-bold ${Number(accuracy) >= 70 ? 'text-green-400' :
                                    Number(accuracy) >= 50 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>{accuracy}%</p>
                                <p className="text-xs text-slate-500">aproveitamento</p>
                            </div>
                        </div>
                    )}

                    {/* Time */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Tempo (minutos) - opcional
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={form.timeMinutes}
                            onChange={(e) => setForm({ ...form, timeMinutes: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white"
                            placeholder="Ex: 60"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Observações - opcional
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none"
                            placeholder="Anotações sobre este bloco de estudo..."
                        />
                    </div>
                </div>

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
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

            {/* Modal para adicionar subdisciplina */}
            {selectedDiscipline && (
                <AddSubdisciplineModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    disciplineId={Number(form.disciplineId)}
                    disciplineName={selectedDiscipline.name}
                    onCreated={handleSubdisciplineCreated}
                />
            )}

            {/* Modal para adicionar assunto */}
            {selectedSubdiscipline && (
                <AddTopicModal
                    isOpen={showAddTopicModal}
                    onClose={() => setShowAddTopicModal(false)}
                    subdisciplineId={Number(form.subdisciplineId)}
                    subdisciplineName={selectedSubdiscipline.name}
                    onCreated={handleTopicCreated}
                />
            )}
        </div>
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
