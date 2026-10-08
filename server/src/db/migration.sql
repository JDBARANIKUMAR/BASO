-- Neon Serverless PostgreSQL Migration for BASO
-- Run once to initialize or upgrade the database schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT,
  mobile TEXT NOT NULL,
  name TEXT DEFAULT '',
  avatar TEXT,
  is_registered BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_users_country_mobile UNIQUE (country_code, mobile)
);

-- Ensure columns exist in case the table was created earlier with a simpler schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. OTP Codes Table
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  mobile TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lightning fast lookups & cleanups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(country_code, mobile);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
