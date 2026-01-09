-- User Authorization Schema
-- Run this migration to set up the users table

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Auth methods (at least one required)
    password_hash VARCHAR(255),
    sso_providers JSONB,
    
    -- Roles
    roles TEXT[] NOT NULL DEFAULT ARRAY['user'],
    
    -- Account status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure at least one auth method exists
    CONSTRAINT user_has_auth_method CHECK (
        password_hash IS NOT NULL OR sso_providers IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);
CREATE INDEX IF NOT EXISTS idx_users_sso ON users USING GIN(sso_providers);
