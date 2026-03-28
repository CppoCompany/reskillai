CREATE TABLE IF NOT EXISTS public.skill_trainings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
    skill           TEXT NOT NULL,
    completed_steps INT[] DEFAULT '{}',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, skill)
);

CREATE TABLE IF NOT EXISTS public.positions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_user_id    TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    required_skills     TEXT[] DEFAULT '{}',
    required_experience INT DEFAULT 0,
    education_level     TEXT DEFAULT 'any',
    location            TEXT DEFAULT 'Remote',
    work_type           TEXT DEFAULT 'remote',
    employment_type     TEXT DEFAULT 'full_time',
    salary_min          INT,
    salary_max          INT,
    status              TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    ai_review           JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.position_matches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id         UUID REFERENCES public.positions(id) ON DELETE CASCADE,
    expert_user_id      TEXT NOT NULL,
    match_score         INT CHECK (match_score BETWEEN 0 AND 100),
    match_explanation   TEXT,
    matched_skills      TEXT[] DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(position_id, expert_user_id)
);
