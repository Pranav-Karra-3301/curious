-- Create questions table to store all generated questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT FALSE
);

-- Create index for faster queries
CREATE INDEX idx_questions_is_current ON questions(is_current);
CREATE INDEX idx_questions_used_at ON questions(used_at);
CREATE INDEX idx_questions_created_at ON questions(created_at);

-- Enable Row Level Security
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous reads
CREATE POLICY "Allow anonymous reads" ON questions
  FOR SELECT
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role writes" ON questions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to get current question or generate new one
CREATE OR REPLACE FUNCTION get_or_create_current_question()
RETURNS TABLE(id UUID, question TEXT, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_hour TIMESTAMP WITH TIME ZONE;
  existing_question RECORD;
BEGIN
  -- Round down to current hour
  current_hour := date_trunc('hour', NOW());
  
  -- Check if we have a current question for this hour
  SELECT q.* INTO existing_question
  FROM questions q
  WHERE q.is_current = true
  AND q.used_at >= current_hour;
  
  IF FOUND THEN
    -- Return existing question
    RETURN QUERY SELECT existing_question.id, existing_question.question, existing_question.created_at;
  ELSE
    -- Mark all current questions as not current
    UPDATE questions SET is_current = false WHERE is_current = true;
    
    -- Return null to signal that a new question needs to be generated
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$;

-- Function to mark a question as used
CREATE OR REPLACE FUNCTION mark_question_as_current(question_text TEXT)
RETURNS TABLE(id UUID, question TEXT, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_question RECORD;
BEGIN
  -- Mark all current questions as not current
  UPDATE questions SET is_current = false WHERE is_current = true;
  
  -- Insert new question or update existing one
  INSERT INTO questions (question, used_at, is_current)
  VALUES (question_text, NOW(), true)
  RETURNING * INTO new_question;
  
  RETURN QUERY SELECT new_question.id, new_question.question, new_question.created_at;
END;
$$;