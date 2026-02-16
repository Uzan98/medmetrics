import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addDays, format, subDays, startOfWeek } from 'date-fns'

export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Get a valid discipline ID for exam scores
        const { data: disciplines } = await supabase
            .from('disciplines')
            .select('id')
            .limit(1)

        const disciplineId = disciplines?.[0]?.id

        if (!disciplineId) {
            return NextResponse.json({ error: 'No disciplines found. Please seed taxonomy first.' }, { status: 400 })
        }

        const logs = []
        const exams = []
        const today = new Date()

        // 2. Generate Question Logs (Heatmap Data) - Last 365 days
        for (let i = 0; i < 365; i++) {
            const date = subDays(today, i)
            const dateStr = format(date, 'yyyy-MM-dd')

            // 60% chance to study on any given day
            if (Math.random() > 0.4) {
                // Skew towards more questions on weekends (0 = Sunday, 6 = Saturday) (just for fun variety)
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const baseQuestions = isWeekend ? 40 : 20
                const questions = Math.floor(Math.random() * 60) + baseQuestions // 20-80 or 40-100 range roughly

                logs.push({
                    user_id: user.id,
                    date: dateStr,
                    questions_done: questions,
                    correct_answers: Math.floor(questions * (0.6 + Math.random() * 0.3)), // 60-90% accuracy
                    discipline_id: disciplineId, // linking all to one generic discipline for simplicity
                    source: 'Seed Script',
                    time_minutes: questions * 2 // approx 2 mins per question
                })
            }
        }

        // 3. Generate Exams (Scatter Plot Data) - Last 52 weeks
        // We need to create the Exam first, then the Score
        // We'll prepare the data and insert one by one or in batches if structure allows

        // Let's insert logs in batch first
        if (logs.length > 0) {
            const { error: logsError } = await supabase
                .from('question_logs')
                .insert(logs)

            if (logsError) console.error('Error inserting logs:', logsError)
        }

        // Generate and Insert Exams
        for (let i = 0; i < 52; i++) {
            // One exam per week roughly
            const date = subDays(today, i * 7)

            // 70% chance to take a simulado that week
            if (Math.random() > 0.3) {
                const { data: examData, error: examError } = await supabase
                    .from('exams')
                    .insert({
                        user_id: user.id,
                        date: format(date, 'yyyy-MM-dd'),
                        year: date.getFullYear(),
                        title: `Simulado Semanal ${52 - i}`,
                    })
                    .select()
                    .single()

                if (examData && !examError) {
                    const total = 50 + Math.floor(Math.random() * 50) // 50-100 questions
                    // Correlate slightly: if we generated logs for this week, maybe better score? 
                    // For now, random 50-90% score
                    const correct = Math.floor(total * (0.5 + Math.random() * 0.4))

                    await supabase
                        .from('exam_scores')
                        .insert({
                            exam_id: examData.id,
                            discipline_id: disciplineId,
                            questions_total: total,
                            questions_correct: correct
                        })
                }
            }
        }

        return NextResponse.json({ success: true, message: `Inserted ~${logs.length} logs and exams.` })

    } catch (error) {
        console.error('Seed error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Delete Seeded Logs
        const { error: logsError } = await supabase
            .from('question_logs')
            .delete()
            .eq('user_id', user.id)
            .eq('source', 'Seed Script')

        if (logsError) throw logsError

        // 2. Delete Seeded Exams (Scores cascade)
        const { error: examsError } = await supabase
            .from('exams')
            .delete()
            .eq('user_id', user.id)
            .ilike('title', 'Simulado Semanal%')

        if (examsError) throw examsError

        return NextResponse.json({ success: true, message: 'Test data cleared.' })

    } catch (error) {
        console.error('Clear error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
