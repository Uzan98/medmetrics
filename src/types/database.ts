export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            appointments: {
                Row: {
                    id: string
                    user_id: string
                    title: string
                    description: string | null
                    date: string
                    start_time: string | null
                    end_time: string | null
                    category: 'aula' | 'plantao' | 'prova' | 'estudo' | 'pessoal' | 'outro'
                    color: string | null
                    completed: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    title: string
                    description?: string | null
                    date: string
                    start_time?: string | null
                    end_time?: string | null
                    category?: 'aula' | 'plantao' | 'prova' | 'estudo' | 'pessoal' | 'outro'
                    color?: string | null
                    completed?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    title?: string
                    description?: string | null
                    date?: string
                    start_time?: string | null
                    end_time?: string | null
                    category?: 'aula' | 'plantao' | 'prova' | 'estudo' | 'pessoal' | 'outro'
                    color?: string | null
                    completed?: boolean
                    created_at?: string
                }
                Relationships: []
            }
            error_notebook: {
                Row: {
                    id: string
                    user_id: string
                    discipline_id: number | null
                    topic_id: number | null
                    question_text: string
                    answer_text: string
                    notes: string | null
                    review_count: number
                    created_at: string
                    image_urls: string[] | null
                    // New/Missing fields
                    interval: number
                    ease_factor: number
                    difficulty_level: number
                    last_reviewed_at: string | null
                    next_review_date: string | null
                    error_type: string | null
                    action_item: string | null
                }
                Insert: {
                    answer_text: string
                    created_at?: string
                    discipline_id?: number | null
                    id?: string
                    image_urls?: string[] | null
                    notes?: string | null
                    question_text: string
                    review_count?: number
                    topic_id?: number | null
                    user_id: string
                    // New/Missing fields
                    interval?: number
                    ease_factor?: number
                    difficulty_level?: number
                    last_reviewed_at?: string | null
                    next_review_date?: string | null
                    error_type?: string | null
                    action_item?: string | null
                }
                Update: {
                    answer_text?: string
                    created_at?: string
                    discipline_id?: number | null
                    id?: string
                    image_urls?: string[] | null
                    notes?: string | null
                    question_text?: string
                    review_count?: number
                    topic_id?: number | null
                    user_id?: string
                    // New/Missing fields
                    interval?: number
                    ease_factor?: number
                    difficulty_level?: number
                    last_reviewed_at?: string | null
                    next_review_date?: string | null
                    error_type?: string | null
                    action_item?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "error_notebook_discipline_id_fkey"
                        columns: ["discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "error_notebook_topic_id_fkey"
                        columns: ["topic_id"]
                        isOneToOne: false
                        referencedRelation: "topics"
                        referencedColumns: ["id"]
                    },
                ]
            }
            exam_boards: {
                Row: {
                    created_at: string
                    id: number
                    name: string
                }
                Insert: {
                    created_at?: string
                    id?: number
                    name: string
                }
                Update: {
                    created_at?: string
                    id?: number
                    name?: string
                }
                Relationships: []
            }
            exam_scores: {
                Row: {
                    created_at: string
                    discipline_id: number
                    exam_id: string
                    id: string
                    questions_correct: number
                    questions_total: number
                }
                Insert: {
                    created_at?: string
                    discipline_id: number
                    exam_id: string
                    id?: string
                    questions_correct: number
                    questions_total: number
                }
                Update: {
                    created_at?: string
                    discipline_id?: number
                    exam_id?: string
                    id?: string
                    questions_correct?: number
                    questions_total?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "exam_scores_discipline_id_fkey"
                        columns: ["discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "exam_scores_exam_id_fkey"
                        columns: ["exam_id"]
                        isOneToOne: false
                        referencedRelation: "exams"
                        referencedColumns: ["id"]
                    },
                ]
            }
            exams: {
                Row: {
                    board_id: number | null
                    created_at: string
                    date: string
                    id: string
                    title: string | null
                    user_id: string
                    year: number
                }
                Insert: {
                    board_id?: number | null
                    created_at?: string
                    date?: string
                    id?: string
                    title?: string | null
                    user_id: string
                    year: number
                }
                Update: {
                    board_id?: number | null
                    created_at?: string
                    date?: string
                    id?: string
                    title?: string | null
                    user_id?: string
                    year?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "exams_board_id_fkey"
                        columns: ["board_id"]
                        isOneToOne: false
                        referencedRelation: "exam_boards"
                        referencedColumns: ["id"]
                    },
                ]
            }
            disciplines: {
                Row: {
                    created_at: string | null
                    id: number
                    name: string
                }
                Insert: {
                    created_at?: string | null
                    id?: number
                    name: string
                }
                Update: {
                    created_at?: string | null
                    id?: number
                    name?: string
                }
                Relationships: []
            }
            question_logs: {
                Row: {
                    accuracy: number | null
                    correct_answers: number
                    created_at: string | null
                    date: string
                    discipline_id: number | null
                    errors: number | null
                    id: string
                    notes: string | null
                    questions_done: number
                    source: string | null
                    subdiscipline_id: number | null
                    topic_id: number | null
                    time_minutes: number | null
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    accuracy?: number | null
                    correct_answers: number
                    created_at?: string | null
                    date: string
                    discipline_id?: number | null
                    errors?: number | null
                    id?: string
                    notes?: string | null
                    questions_done: number
                    source?: string | null
                    subdiscipline_id?: number | null
                    topic_id?: number | null
                    time_minutes?: number | null
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    accuracy?: number | null
                    correct_answers?: number
                    created_at?: string | null
                    date?: string
                    discipline_id?: number | null
                    errors?: number | null
                    id?: string
                    notes?: string | null
                    questions_done?: number
                    source?: string | null
                    subdiscipline_id?: number | null
                    topic_id?: number | null
                    time_minutes?: number | null
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "question_logs_discipline_id_fkey"
                        columns: ["discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "question_logs_subdiscipline_id_fkey"
                        columns: ["subdiscipline_id"]
                        isOneToOne: false
                        referencedRelation: "subdisciplines"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "question_logs_topic_id_fkey"
                        columns: ["topic_id"]
                        isOneToOne: false
                        referencedRelation: "topics"
                        referencedColumns: ["id"]
                    },
                ]
            }
            scheduled_reviews: {
                Row: {
                    completed: boolean
                    completed_at: string | null
                    created_at: string
                    discipline_id: number | null
                    id: string
                    question_log_id: string
                    review_type: "1d" | "7d" | "30d"
                    scheduled_date: string
                    subdiscipline_id: number | null
                    user_id: string
                }
                Insert: {
                    completed?: boolean
                    completed_at?: string | null
                    created_at?: string
                    discipline_id?: number | null
                    id?: string
                    question_log_id: string
                    review_type: "1d" | "7d" | "30d"
                    scheduled_date: string
                    subdiscipline_id?: number | null
                    user_id: string
                }
                Update: {
                    completed?: boolean
                    completed_at?: string | null
                    created_at?: string
                    discipline_id?: number | null
                    id?: string
                    question_log_id?: string
                    review_type?: "1d" | "7d" | "30d"
                    scheduled_date?: string
                    subdiscipline_id?: number | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "scheduled_reviews_question_log_id_fkey"
                        columns: ["question_log_id"]
                        isOneToOne: false
                        referencedRelation: "question_logs"
                        referencedColumns: ["id"]
                    }
                ]
            }
            subdisciplines: {
                Row: {
                    created_at: string | null
                    discipline_id: number | null
                    id: number
                    name: string
                }
                Insert: {
                    created_at?: string | null
                    discipline_id?: number | null
                    id?: number
                    name: string
                }
                Update: {
                    created_at?: string | null
                    discipline_id?: number | null
                    id?: number
                    name?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "subdisciplines_discipline_id_fkey"
                        columns: ["discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    },
                ]
            }
            topics: {
                Row: {
                    created_at: string | null
                    id: number
                    name: string
                    subdiscipline_id: number | null
                }
                Insert: {
                    created_at?: string | null
                    id?: number
                    name: string
                    subdiscipline_id?: number | null
                }
                Update: {
                    created_at?: string | null
                    id?: number
                    name?: string
                    subdiscipline_id?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "topics_subdiscipline_id_fkey"
                        columns: ["subdiscipline_id"]
                        isOneToOne: false
                        referencedRelation: "subdisciplines"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_goals: {
                Row: {
                    created_at: string | null
                    id: string
                    month: number
                    target_questions: number
                    user_id: string
                    year: number
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    month: number
                    target_questions: number
                    user_id: string
                    year: number
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    month?: number
                    target_questions?: number
                    user_id?: string
                    year?: number
                }
                Relationships: []
            }
            study_schedules: {
                Row: {
                    created_at: string
                    duration_weeks: number
                    id: string
                    rotation_discipline_id: number
                    start_date: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    duration_weeks: number
                    id?: string
                    rotation_discipline_id: number
                    start_date: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    duration_weeks?: number
                    id?: string
                    rotation_discipline_id?: number
                    start_date?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "study_schedules_rotation_discipline_id_fkey"
                        columns: ["rotation_discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    }
                ]
            }
            schedule_items: {
                Row: {
                    created_at: string
                    id: string
                    schedule_id: string
                    status: 'pending' | 'completed'
                    study_date: string
                    topic_id: number
                }
                Insert: {
                    created_at?: string
                    id?: string
                    schedule_id: string
                    status?: 'pending' | 'completed'
                    study_date: string
                    topic_id: number
                }
                Update: {
                    created_at?: string
                    id?: string
                    schedule_id?: string
                    status?: 'pending' | 'completed'
                    study_date?: string
                    topic_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "schedule_items_schedule_id_fkey"
                        columns: ["schedule_id"]
                        isOneToOne: false
                        referencedRelation: "study_schedules"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "schedule_items_topic_id_fkey"
                        columns: ["topic_id"]
                        isOneToOne: false
                        referencedRelation: "topics"
                        referencedColumns: ["id"]
                    }
                ]
            }
            study_sessions: {
                Row: {
                    id: string
                    user_id: string
                    started_at: string
                    completed_at: string | null
                    cards_reviewed: number
                    cards_correct: number
                    cards_wrong: number
                    xp_earned: number
                    discipline_id: number | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    started_at?: string
                    completed_at?: string | null
                    cards_reviewed?: number
                    cards_correct?: number
                    cards_wrong?: number
                    xp_earned?: number
                    discipline_id?: number | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    started_at?: string
                    completed_at?: string | null
                    cards_reviewed?: number
                    cards_correct?: number
                    cards_wrong?: number
                    xp_earned?: number
                    discipline_id?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "study_sessions_discipline_id_fkey"
                        columns: ["discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    }
                ]
            }
            flashcard_reviews: {
                Row: {
                    id: string
                    flashcard_id: string
                    session_id: string | null
                    user_id: string
                    reviewed_at: string
                    difficulty: 'easy' | 'hard' | 'wrong'
                    xp_earned: number
                }
                Insert: {
                    id?: string
                    flashcard_id: string
                    session_id?: string | null
                    user_id: string
                    reviewed_at?: string
                    difficulty: 'easy' | 'hard' | 'wrong'
                    xp_earned?: number
                }
                Update: {
                    id?: string
                    flashcard_id?: string
                    session_id?: string | null
                    user_id?: string
                    reviewed_at?: string
                    difficulty?: 'easy' | 'hard' | 'wrong'
                    xp_earned?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
                        columns: ["flashcard_id"]
                        isOneToOne: false
                        referencedRelation: "error_notebook"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "flashcard_reviews_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "study_sessions"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_study_stats: {
                Row: {
                    id: string
                    user_id: string
                    current_streak: number
                    longest_streak: number
                    total_xp: number
                    total_cards_reviewed: number
                    last_study_date: string | null
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    current_streak?: number
                    longest_streak?: number
                    total_xp?: number
                    total_cards_reviewed?: number
                    last_study_date?: string | null
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    current_streak?: number
                    longest_streak?: number
                    total_xp?: number
                    total_cards_reviewed?: number
                    last_study_date?: string | null
                    updated_at?: string
                }
                Relationships: []
            }
            user_settings: {
                Row: {
                    user_id: string
                    fsrs_retention: number
                    fsrs_params: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    fsrs_retention?: number
                    fsrs_params?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    user_id?: string
                    fsrs_retention?: number
                    fsrs_params?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }

        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Discipline = Tables<'disciplines'>
export type Subdiscipline = Tables<'subdisciplines'>
export type Topic = Tables<'topics'>
export type QuestionLog = Tables<'question_logs'>
export type UserGoal = Tables<'user_goals'>
export type ScheduledReview = Tables<'scheduled_reviews'>
export type Exam = Tables<'exams'>
export type ExamBoard = Tables<'exam_boards'>
export type ExamScore = Tables<'exam_scores'>
export type StudySchedule = Tables<'study_schedules'>
export type ScheduleItem = Tables<'schedule_items'>
export type StudySession = Tables<'study_sessions'>
export type FlashcardReview = Tables<'flashcard_reviews'>
export type UserStudyStats = Tables<'user_study_stats'>
export type Appointment = Tables<'appointments'>
export type UserSettings = Tables<'user_settings'>

