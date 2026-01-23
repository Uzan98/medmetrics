-- Create study_schedules table
CREATE TABLE IF NOT EXISTS study_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rotation_discipline_id BIGINT REFERENCES disciplines(id) ON DELETE CASCADE NOT NULL,
    duration_weeks INTEGER NOT NULL,
    start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create schedule_items table
CREATE TABLE IF NOT EXISTS schedule_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID REFERENCES study_schedules(id) ON DELETE CASCADE NOT NULL,
    topic_id BIGINT REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
    study_date DATE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE study_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;

-- Create policies for study_schedules
CREATE POLICY "Users can insert their own schedules" ON study_schedules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own schedules" ON study_schedules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules" ON study_schedules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules" ON study_schedules
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for schedule_items
-- We check schedule ownership via the schedule_id
CREATE POLICY "Users can view own schedule items" ON schedule_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM study_schedules
            WHERE study_schedules.id = schedule_items.schedule_id
            AND study_schedules.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own schedule items" ON schedule_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM study_schedules
            WHERE study_schedules.id = schedule_items.schedule_id
            AND study_schedules.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own schedule items" ON schedule_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM study_schedules
            WHERE study_schedules.id = schedule_items.schedule_id
            AND study_schedules.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own schedule items" ON schedule_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM study_schedules
            WHERE study_schedules.id = schedule_items.schedule_id
            AND study_schedules.user_id = auth.uid()
        )
    );
