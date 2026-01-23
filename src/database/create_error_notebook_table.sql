-- Create error_notebook table
CREATE TABLE IF NOT EXISTS error_notebook (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    discipline_id BIGINT REFERENCES disciplines(id) ON DELETE SET NULL,
    topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    notes TEXT,
    review_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE error_notebook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own error notebook"
    ON error_notebook FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own error notebook"
    ON error_notebook FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own error notebook"
    ON error_notebook FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own error notebook"
    ON error_notebook FOR DELETE
    USING (auth.uid() = user_id);
