-- Cookbook App Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Cookbooks table
CREATE TABLE IF NOT EXISTS cookbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cover_image_url TEXT,
  scanned_pages INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cookbooks_user_id ON cookbooks(user_id);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  prep_time VARCHAR(50),
  cook_time VARCHAR(50),
  total_time VARCHAR(50),
  servings INTEGER,
  notes TEXT,
  page_number INTEGER,
  original_image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recipes_cookbook_id ON recipes(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);

-- Ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  unit VARCHAR(50),
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id);

-- Instructions table
CREATE TABLE IF NOT EXISTS instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instructions_recipe_id ON instructions(recipe_id);

-- Fridge items table
CREATE TABLE IF NOT EXISTS fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  category VARCHAR(100),
  freshness VARCHAR(50),
  packaging VARCHAR(100),
  confidence VARCHAR(20),
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fridge_items_user_id ON fridge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_fridge_items_category ON fridge_items(category);

-- Scan history table
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_type VARCHAR(50) NOT NULL,
  image_url TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  result_data JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);

-- Scan jobs table (async processing queue)
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- For cookbook scans
  cookbook_id UUID REFERENCES cookbooks(id) ON DELETE CASCADE,
  cookbook_name VARCHAR(255),
  total_pages INTEGER,
  processed_pages INTEGER DEFAULT 0,
  
  -- For fridge scans
  items_found INTEGER,
  
  -- Image references
  image_urls TEXT[],
  
  -- Results
  result_data JSONB,
  error_message TEXT,
  error_code VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time_ms INTEGER,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_status ON scan_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cookbooks_updated_at ON cookbooks;
CREATE TRIGGER update_cookbooks_updated_at BEFORE UPDATE ON cookbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fridge_items_updated_at ON fridge_items;
CREATE TRIGGER update_fridge_items_updated_at BEFORE UPDATE ON fridge_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add scan_job_id to fridge_items
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS scan_job_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_fridge_items_scan_job_id ON fridge_items(scan_job_id);
CREATE INDEX IF NOT EXISTS idx_fridge_items_user_scan_job ON fridge_items(user_id, scan_job_id);

-- Match jobs table
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

CREATE INDEX IF NOT EXISTS idx_match_jobs_user_id ON match_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_match_jobs_status ON match_jobs(status);
CREATE INDEX IF NOT EXISTS idx_match_jobs_created_at ON match_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_jobs_cookbook_id ON match_jobs(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_match_jobs_fridge_scan_id ON match_jobs(fridge_scan_id);

-- Recipe matches table
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

CREATE INDEX IF NOT EXISTS idx_recipe_matches_match_job_id ON recipe_matches(match_job_id);
CREATE INDEX IF NOT EXISTS idx_recipe_matches_recipe_id ON recipe_matches(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_matches_percentage ON recipe_matches(match_percentage DESC);

-- Cuisine and dietary tags for recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cuisine VARCHAR(50);
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dietary_tags TEXT[];
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_dietary_tags ON recipes USING GIN(dietary_tags);
