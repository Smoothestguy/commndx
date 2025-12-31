-- Add 'closed' value to estimate_status enum
ALTER TYPE estimate_status ADD VALUE IF NOT EXISTS 'closed';