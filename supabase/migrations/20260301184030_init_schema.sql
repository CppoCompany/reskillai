-- ============================================================
--  ReSkillAI - Supabase Database Schema
--  Stack: PostgreSQL via Supabase
--  Modules: Auth, Career Assessment, Expert Marketplace, Matching, Payments
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";


-- ============================================================
-- 1. USERS & AUTH
-- ============================================================

CREATE TABLE public.users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id        TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    full_name       TEXT,
    avatar_url      TEXT,
    user_type       TEXT CHECK (user_type IN ('expert', 'business')) NOT NULL,
    plan            TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 2. EXPERT PROFILES
-- ============================================================

CREATE TABLE public.expert_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES public.users(id) ON DELETE CASCADE,
    profession          TEXT NOT NULL,               -- 'software_engineer', 'lawyer', 'accountant', 'sales'
    years_experience    INT NOT NULL,
    industries          TEXT[],                      -- ['fintech', 'healthcare', 'legal']
    skills              TEXT[],                      -- ['python', 'contract_law', 'tax_planning']
    languages           TEXT[],                      -- ['en', 'he', 'es']
    bio                 TEXT,
    linkedin_url        TEXT,
    hourly_rate         INT,                         -- USD
    availability        TEXT CHECK (availability IN ('full_time', 'part_time', 'project_based')),
    location            TEXT,
    timezone            TEXT,

    -- AI Assessment
    ai_risk_score       INT CHECK (ai_risk_score BETWEEN 0 AND 100),  -- סיכון להחלפת AI
    ai_risk_level       TEXT CHECK (ai_risk_level IN ('low', 'medium', 'high', 'critical')),
    ai_risk_summary     TEXT,                        -- הסבר קצר על הסיכון

    -- Marketplace
    is_verified         BOOLEAN DEFAULT FALSE,
    is_visible          BOOLEAN DEFAULT TRUE,
    verification_date   TIMESTAMPTZ,
    total_matches       INT DEFAULT 0,
    success_rate        DECIMAL(4,2),                -- אחוז הצלחה

    -- Vector for AI Matching
    embedding           VECTOR(1536),

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_expert_profession ON public.expert_profiles(profession);
CREATE INDEX idx_expert_verified ON public.expert_profiles(is_verified);
CREATE INDEX idx_expert_risk ON public.expert_profiles(ai_risk_level);


-- ============================================================
-- 3. BUSINESS PROFILES
-- ============================================================

CREATE TABLE public.business_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
    company_name    TEXT NOT NULL,
    industry        TEXT NOT NULL,
    company_size    TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '200+')),
    website         TEXT,
    description     TEXT,
    location        TEXT,
    needs           TEXT[],                          -- ['legal_counsel', 'tax_planning', 'software_dev']
    budget_range    TEXT CHECK (budget_range IN ('under_1k', '1k_5k', '5k_20k', '20k+')),
    embedding       VECTOR(1536),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);


-- ============================================================
-- 4. CAREER ASSESSMENTS
-- ============================================================

CREATE TABLE public.career_assessments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES public.users(id) ON DELETE CASCADE,

    -- Input
    job_title               TEXT NOT NULL,
    current_industry        TEXT NOT NULL,
    years_experience        INT NOT NULL,
    current_skills          TEXT[],
    education_level         TEXT CHECK (education_level IN ('high_school', 'bachelor', 'master', 'phd', 'other')),
    annual_salary           INT,                     -- USD
    location                TEXT,

    -- AI Output
    ai_displacement_risk    INT CHECK (ai_displacement_risk BETWEEN 0 AND 100),
    risk_level              TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_explanation        TEXT,                    -- למה הסיכון הזה
    affected_tasks          TEXT[],                  -- אילו משימות ספציפיות בסיכון
    safe_tasks              TEXT[],                  -- אילו משימות בטוחות

    -- Recommended Path
    recommended_path        TEXT,                    -- 'pivot', 'upskill', 'specialize', 'entrepreneurship'
    path_explanation        TEXT,
    recommended_roles       TEXT[],                  -- תפקידים מומלצים
    skills_to_learn         TEXT[],                  -- מיומנויות לרכוש
    timeline_months         INT,                     -- כמה זמן להסבה
    salary_potential        INT,                     -- פוטנציאל שכר לאחר הסבה USD

    -- Meta
    is_pro_assessment       BOOLEAN DEFAULT FALSE,   -- האם הערכה מלאה (Pro)
    tokens_used             INT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_user ON public.career_assessments(user_id);
CREATE INDEX idx_assessments_risk ON public.career_assessments(risk_level);


-- ============================================================
-- 5. JOB POSTS (MARKETPLACE)
-- ============================================================

CREATE TABLE public.job_posts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    required_profession TEXT NOT NULL,
    required_skills     TEXT[],
    required_experience INT,                         -- שנות ניסיון מינימום
    budget_type         TEXT CHECK (budget_type IN ('hourly', 'fixed', 'monthly')),
    budget_amount       INT,                         -- USD
    duration            TEXT CHECK (duration IN ('one_time', 'short_term', 'long_term', 'ongoing')),
    location_type       TEXT CHECK (location_type IN ('remote', 'onsite', 'hybrid')),
    location            TEXT,
    status              TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    views_count         INT DEFAULT 0,
    applications_count  INT DEFAULT 0,
    embedding           VECTOR(1536),                -- לצורך AI Matching
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON public.job_posts(status);
CREATE INDEX idx_jobs_profession ON public.job_posts(required_profession);
CREATE INDEX idx_jobs_business ON public.job_posts(business_id);


-- ============================================================
-- 6. MATCHES
-- ============================================================

CREATE TABLE public.matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expert_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
    job_id          UUID REFERENCES public.job_posts(id) ON DELETE CASCADE,
    match_score     DECIMAL(4,3) CHECK (match_score BETWEEN 0 AND 1),
    match_reasons   TEXT[],                          -- ['10 years experience', 'exact skills match']
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'applied', 'accepted', 'rejected', 'completed')),
    initiated_by    TEXT CHECK (initiated_by IN ('ai', 'expert', 'business')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(expert_id, job_id)
);

CREATE INDEX idx_matches_expert ON public.matches(expert_id);
CREATE INDEX idx_matches_job ON public.matches(job_id);
CREATE INDEX idx_matches_status ON public.matches(status);


-- ============================================================
-- 7. MESSAGES
-- ============================================================

CREATE TABLE public.conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    expert_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
    business_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
    last_message    TEXT,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    sent_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_conversations_expert ON public.conversations(expert_id);
CREATE INDEX idx_conversations_business ON public.conversations(business_id);


-- ============================================================
-- 8. PAYMENTS & SUBSCRIPTIONS
-- ============================================================

CREATE TABLE public.subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES public.users(id) ON DELETE CASCADE,
    plan                TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    stripe_customer_id  TEXT,
    stripe_sub_id       TEXT,
    status              TEXT CHECK (status IN ('active', 'cancelled', 'past_due')),
    current_period_start TIMESTAMPTZ,
    current_period_end  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE public.transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
    match_id        UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    amount          INT NOT NULL,                    -- cents
    currency        TEXT DEFAULT 'USD',
    type            TEXT CHECK (type IN ('subscription', 'commission', 'refund')),
    stripe_id       TEXT,
    status          TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 9. REVIEWS
-- ============================================================

CREATE TABLE public.reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    reviewer_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reviewee_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
    rating          INT CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewee ON public.reviews(reviewee_id);


-- ============================================================
-- 10. USAGE TRACKING (Freemium limits)
-- ============================================================

CREATE TABLE public.usage_tracking (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES public.users(id) ON DELETE CASCADE,
    month                   TEXT NOT NULL,           -- '2026-02'
    assessments_count       INT DEFAULT 0,
    matches_count           INT DEFAULT 0,
    messages_count          INT DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month)
);


-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (clerk_id = auth.jwt()->>'sub');

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (clerk_id = auth.jwt()->>'sub');

-- Expert Profiles - גלויים לכולם, עריכה רק לבעלים
CREATE POLICY "expert_profiles_public_read" ON public.expert_profiles
    FOR SELECT USING (is_visible = TRUE);

CREATE POLICY "expert_profiles_own_write" ON public.expert_profiles
    FOR ALL USING (
        user_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
    );

-- Career Assessments - רק לבעלים
CREATE POLICY "assessments_own" ON public.career_assessments
    FOR ALL USING (
        user_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
    );

-- Job Posts - קריאה לכולם, כתיבה לבעלים
CREATE POLICY "jobs_public_read" ON public.job_posts
    FOR SELECT USING (status = 'open');

CREATE POLICY "jobs_own_write" ON public.job_posts
    FOR ALL USING (
        business_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
    );

-- Matches - רק למעורבים
CREATE POLICY "matches_own" ON public.matches
    FOR ALL USING (
        expert_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
        OR job_id IN (
            SELECT id FROM public.job_posts
            WHERE business_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
        )
    );

-- Messages - רק למעורבים בשיחה
CREATE POLICY "messages_own" ON public.messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM public.conversations
            WHERE expert_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
            OR business_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub')
        )
    );


-- ============================================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================================

-- עדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER expert_profiles_updated_at
    BEFORE UPDATE ON public.expert_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER job_posts_updated_at
    BEFORE UPDATE ON public.job_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- בדיקת מגבלות Freemium לפני יצירת match
CREATE OR REPLACE FUNCTION check_freemium_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_plan TEXT;
    v_matches_count INT;
    v_month TEXT;
BEGIN
    v_month := TO_CHAR(NOW(), 'YYYY-MM');

    SELECT u.plan INTO v_plan
    FROM public.users u
    WHERE u.id = NEW.expert_id;

    IF v_plan = 'free' THEN
        SELECT COALESCE(matches_count, 0) INTO v_matches_count
        FROM public.usage_tracking
        WHERE user_id = NEW.expert_id AND month = v_month;

        IF v_matches_count >= 3 THEN
            RAISE EXCEPTION 'Free plan limit reached. Upgrade to Pro for unlimited matches.';
        END IF;

        INSERT INTO public.usage_tracking (user_id, month, matches_count)
        VALUES (NEW.expert_id, v_month, 1)
        ON CONFLICT (user_id, month)
        DO UPDATE SET matches_count = usage_tracking.matches_count + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_freemium_limits
    BEFORE INSERT ON public.matches
    FOR EACH ROW EXECUTE FUNCTION check_freemium_limits();

-- פונקציית AI Matching - מוצאת מומחים מתאימים לפוסט עבודה
CREATE OR REPLACE FUNCTION find_expert_matches(
    p_job_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    expert_id UUID,
    full_name TEXT,
    profession TEXT,
    years_experience INT,
    hourly_rate INT,
    ai_risk_score INT,
    match_similarity FLOAT
) AS $$
DECLARE
    v_embedding VECTOR(1536);
BEGIN
    SELECT embedding INTO v_embedding
    FROM public.job_posts WHERE id = p_job_id;

    RETURN QUERY
    SELECT
        u.id,
        u.full_name,
        ep.profession,
        ep.years_experience,
        ep.hourly_rate,
        ep.ai_risk_score,
        1 - (ep.embedding <=> v_embedding) AS similarity
    FROM public.expert_profiles ep
    JOIN public.users u ON u.id = ep.user_id
    WHERE ep.is_verified = TRUE
        AND ep.is_visible = TRUE
        AND ep.embedding IS NOT NULL
    ORDER BY ep.embedding <=> v_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Vector indexes
CREATE INDEX idx_expert_embedding ON public.expert_profiles
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_jobs_embedding ON public.job_posts
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
