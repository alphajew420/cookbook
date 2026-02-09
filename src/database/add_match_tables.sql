-- Migration: Add match_jobs and recipe_matches tables for Recipe Matching feature

BEGIN;

-- Create match_jobs table
CREATE TABLE IF NOT EXISTS match_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  cookbook_name VARCHAR(255) NOT NULL,
  fridge_scan_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total_recipes INTEGER,
  matched_recipes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER,
  error_message TEXT,
  error_code VARCHAR(100),
  
  CONSTRAINT match_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create recipe_matches table
CREATE TABLE IF NOT EXISTS recipe_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_job_id UUID NOT NULL REFERENCES match_jobs(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_name VARCHAR(255) NOT NULL,
  match_percentage INTEGER NOT NULL,
  total_ingredients INTEGER NOT NULL,
  available_ingredients INTEGER NOT NULL,
  missing_ingredients INTEGER NOT NULL,
  available_ingredients_list JSONB NOT NULL,
  missing_ingredients_list JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT recipe_matches_percentage_check CHECK (match_percentage >= 0 AND match_percentage <= 100)
);

-- Create indexes for match_jobs
CREATE INDEX IF NOT EXISTS idx_match_jobs_user_id ON match_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_match_jobs_status ON match_jobs(status);
CREATE INDEX IF NOT EXISTS idx_match_jobs_created_at ON match_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_jobs_cookbook_id ON match_jobs(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_match_jobs_fridge_scan_id ON match_jobs(fridge_scan_id);

-- Create indexes for recipe_matches
CREATE INDEX IF NOT EXISTS idx_recipe_matches_match_job_id ON recipe_matches(match_job_id);
CREATE INDEX IF NOT EXISTS idx_recipe_matches_recipe_id ON recipe_matches(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_matches_percentage ON recipe_matches(match_percentage DESC);

COMMIT;
