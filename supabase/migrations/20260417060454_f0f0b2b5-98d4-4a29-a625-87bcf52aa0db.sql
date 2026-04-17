-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  answer_index SMALLINT NOT NULL,
  answer_text TEXT,
  explanation TEXT NOT NULL DEFAULT '',
  explanation_depth TEXT NOT NULL DEFAULT 'short',
  difficulty SMALLINT NOT NULL DEFAULT 1,
  srs_stage SMALLINT NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_user_category ON public.questions(user_id, category);
CREATE INDEX idx_questions_user_next_review ON public.questions(user_id, next_review_at);
CREATE INDEX idx_questions_user_starred ON public.questions(user_id, is_starred) WHERE is_starred = true;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own questions select" ON public.questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own questions insert" ON public.questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own questions update" ON public.questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own questions delete" ON public.questions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- answer_logs table
CREATE TABLE public.answer_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  selected_index SMALLINT,
  selected_text TEXT,
  srs_rating TEXT,
  mode TEXT NOT NULL DEFAULT 'quiz',
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_answer_logs_user_question ON public.answer_logs(user_id, question_id);
CREATE INDEX idx_answer_logs_user_answered ON public.answer_logs(user_id, answered_at DESC);

ALTER TABLE public.answer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own logs select" ON public.answer_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own logs insert" ON public.answer_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own logs update" ON public.answer_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own logs delete" ON public.answer_logs FOR DELETE USING (auth.uid() = user_id);