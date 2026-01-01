-- Tender Database Schema for Supabase
-- Pork Sensory Evaluation Application
-- Created: November 30, 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Core Tables
-- ============================================

-- Pork chop samples with quality metrics
CREATE TABLE pork_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    study_number INTEGER NOT NULL,
    original_chop_id INTEGER,
    standardized_chop_id TEXT UNIQUE NOT NULL,
    block INTEGER,
    setting TEXT,
    sex TEXT,
    sireline TEXT,
    days_aging INTEGER,
    days_display INTEGER,
    
    -- pH measurement
    ph DECIMAL(4,2),
    
    -- Ventral (belly side) measurements
    ventral_color DECIMAL(3,1),
    ventral_marbling DECIMAL(3,1),
    ventral_firmness DECIMAL(3,1),
    minolta_ventral_l DECIMAL(6,4),
    minolta_ventral_a DECIMAL(6,4),
    minolta_ventral_b DECIMAL(6,4),
    
    -- Chop (cut surface) measurements
    chop_color DECIMAL(3,1),
    chop_marbling DECIMAL(3,1),
    chop_firmness DECIMAL(3,1),
    minolta_chop_l DECIMAL(6,4),
    minolta_chop_a DECIMAL(6,4),
    minolta_chop_b DECIMAL(6,4),
    
    -- Composition
    moisture_percent DECIMAL(6,4),
    fat_percent DECIMAL(6,4),
    
    -- Metadata
    source_file TEXT,
    import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT valid_study_number CHECK (study_number > 0)
);

-- Experiments configuration
CREATE TABLE experiments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    experiment_type TEXT NOT NULL, -- 'paired_comparison', 'ranking', 'preference'
    num_images INTEGER NOT NULL DEFAULT 2,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'completed', 'archived'
    
    -- Experiment settings
    randomize_order BOOLEAN DEFAULT TRUE,
    collect_timing BOOLEAN DEFAULT TRUE,
    collect_click_data BOOLEAN DEFAULT TRUE,
    instructions TEXT,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Sample groups for experiments
CREATE TABLE experiment_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    sample_id UUID REFERENCES pork_samples(id) ON DELETE CASCADE,
    sample_order INTEGER,
    display_label TEXT, -- Optional label shown to participants
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(experiment_id, sample_id)
);

-- Participant sessions
CREATE TABLE participant_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    session_code TEXT UNIQUE NOT NULL, -- Anonymous session identifier
    
    -- Demographics (optional, configurable per experiment)
    age_group TEXT,
    gender TEXT,
    location TEXT,
    
    -- Session tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual responses
CREATE TABLE responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES participant_sessions(id) ON DELETE CASCADE,
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    
    -- Response data
    selected_sample_id UUID REFERENCES pork_samples(id),
    comparison_set JSONB, -- Array of sample IDs shown together
    rank_order JSONB, -- For ranking experiments
    
    -- Interaction metrics
    response_time_ms INTEGER, -- Time to make selection
    click_positions JSONB, -- Array of {x, y, timestamp} coordinates
    view_duration_per_image JSONB, -- Object mapping sample_id to view time
    
    -- Additional data
    confidence_rating INTEGER, -- Optional 1-5 scale
    comments TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Image metadata (for linking to actual image files)
CREATE TABLE sample_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sample_id UUID REFERENCES pork_samples(id) ON DELETE CASCADE,
    image_type TEXT NOT NULL, -- 'ventral', 'chop', 'full'
    image_url TEXT NOT NULL, -- URL in Supabase Storage
    thumbnail_url TEXT,
    
    -- Image properties
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    format TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(sample_id, image_type)
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_pork_samples_study ON pork_samples(study_number);
CREATE INDEX idx_pork_samples_standardized_id ON pork_samples(standardized_chop_id);
CREATE INDEX idx_pork_samples_color ON pork_samples(chop_color, chop_marbling);

CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_created_by ON experiments(created_by);

CREATE INDEX idx_experiment_samples_experiment ON experiment_samples(experiment_id);
CREATE INDEX idx_experiment_samples_sample ON experiment_samples(sample_id);

CREATE INDEX idx_sessions_experiment ON participant_sessions(experiment_id);
CREATE INDEX idx_sessions_code ON participant_sessions(session_code);

CREATE INDEX idx_responses_session ON responses(session_id);
CREATE INDEX idx_responses_experiment ON responses(experiment_id);
CREATE INDEX idx_responses_sample ON responses(selected_sample_id);

CREATE INDEX idx_sample_images_sample ON sample_images(sample_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE pork_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_images ENABLE ROW LEVEL SECURITY;

-- Pork samples: Researchers can manage, participants can read
CREATE POLICY "Researchers can manage pork samples"
    ON pork_samples FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Public can view pork samples in active experiments"
    ON pork_samples FOR SELECT
    USING (TRUE);

-- Experiments: Researchers can manage
CREATE POLICY "Researchers can manage experiments"
    ON experiments FOR ALL
    USING (auth.uid() = created_by);

CREATE POLICY "Public can view active experiments"
    ON experiments FOR SELECT
    USING (status = 'active');

-- Experiment samples: Follow experiment permissions
CREATE POLICY "Manage experiment samples"
    ON experiment_samples FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = experiment_samples.experiment_id
            AND experiments.created_by = auth.uid()
        )
    );

CREATE POLICY "Public can view experiment samples"
    ON experiment_samples FOR SELECT
    USING (TRUE);

-- Participant sessions: Users can only see their own
CREATE POLICY "Users can manage their own sessions"
    ON participant_sessions FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

-- Responses: Users can insert their own, researchers can view all
CREATE POLICY "Users can insert responses"
    ON responses FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Researchers can view all responses"
    ON responses FOR SELECT
    USING (auth.role() = 'authenticated');

-- Sample images: Follow sample permissions
CREATE POLICY "Public can view sample images"
    ON sample_images FOR SELECT
    USING (TRUE);

CREATE POLICY "Researchers can manage sample images"
    ON sample_images FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================
-- Functions and Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pork_samples_updated_at
    BEFORE UPDATE ON pork_samples
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at
    BEFORE UPDATE ON experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views for Analytics
-- ============================================

-- Summary statistics per study
-- Uses SECURITY INVOKER to respect RLS policies
CREATE VIEW study_summary 
WITH (security_invoker=true) AS
SELECT 
    study_number,
    COUNT(*) as sample_count,
    ROUND(AVG(chop_color)::numeric, 2) as avg_color,
    ROUND(AVG(chop_marbling)::numeric, 2) as avg_marbling,
    ROUND(AVG(ph)::numeric, 2) as avg_ph,
    ROUND(AVG(moisture_percent)::numeric, 4) as avg_moisture,
    ROUND(AVG(fat_percent)::numeric, 4) as avg_fat
FROM pork_samples
GROUP BY study_number
ORDER BY study_number;

-- Experiment participation summary
-- Uses SECURITY INVOKER to respect RLS policies
CREATE VIEW experiment_participation 
WITH (security_invoker=true) AS
SELECT 
    e.id,
    e.name,
    e.status,
    COUNT(DISTINCT ps.id) as participant_count,
    COUNT(DISTINCT r.id) as response_count,
    ROUND(AVG(r.response_time_ms)::numeric, 0) as avg_response_time_ms
FROM experiments e
LEFT JOIN participant_sessions ps ON e.id = ps.experiment_id
LEFT JOIN responses r ON ps.id = r.session_id
GROUP BY e.id, e.name, e.status;
