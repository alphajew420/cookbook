-- Migration: Add scan_job_id to fridge_items table
-- This links fridge items to the scan job that created them

-- Add scan_job_id column to fridge_items table
ALTER TABLE fridge_items 
ADD COLUMN IF NOT EXISTS scan_job_id UUID NULL;

-- Add foreign key constraint
ALTER TABLE fridge_items
ADD CONSTRAINT fk_fridge_items_scan_job 
  FOREIGN KEY (scan_job_id) 
  REFERENCES scan_jobs(id) 
  ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fridge_items_scan_job_id 
ON fridge_items(scan_job_id);

-- Create composite index for user + scan_job queries
CREATE INDEX IF NOT EXISTS idx_fridge_items_user_scan_job 
ON fridge_items(user_id, scan_job_id);
