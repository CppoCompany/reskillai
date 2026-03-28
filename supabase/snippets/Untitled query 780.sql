ALTER TABLE position_matches ADD COLUMN IF NOT EXISTS is_relevant BOOLEAN;
ALTER TABLE position_matches ADD COLUMN IF NOT EXISTS comment TEXT;
