-- Nano Banana AI - Database Setup Script
-- Project: https://gpsxrvqgnxqafftxdilc.supabase.co
-- Execute this script in Supabase SQL Editor

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    credits INTEGER DEFAULT 0,
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'starter', 'pro', 'studio')),
    subscription_id TEXT,
    subscription_expires_at TIMESTAMPTZ,
    total_generations INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anonymous user tracking table
CREATE TABLE IF NOT EXISTS public.anonymous_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint TEXT UNIQUE NOT NULL,
    ip_address INET,
    generations_used INTEGER DEFAULT 0,
    last_generation_at TIMESTAMPTZ,
    daily_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('day', NOW() + INTERVAL '1 day'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Image generations table
CREATE TABLE IF NOT EXISTS public.generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    anonymous_id UUID REFERENCES public.anonymous_users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    aspect_ratio TEXT DEFAULT '1:1' CHECK (aspect_ratio IN ('1:1', '4:3', '3:4', '16:9', '9:16')),
    style TEXT,
    model_used TEXT DEFAULT 'flux-dev',
    generation_type TEXT DEFAULT 'text_to_image' CHECK (generation_type IN ('text_to_image', 'image_to_image')),
    source_image_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    replicate_prediction_id TEXT,
    cost_credits INTEGER DEFAULT 1,
    processing_time_seconds INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Ensure either user_id or anonymous_id is set, but not both
    CONSTRAINT check_user_or_anonymous CHECK (
        (user_id IS NOT NULL AND anonymous_id IS NULL) OR 
        (user_id IS NULL AND anonymous_id IS NOT NULL)
    )
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL, -- Positive for credits added, negative for credits used
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'subscription', 'generation', 'refund', 'bonus')),
    description TEXT,
    generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
    payment_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment records table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'hkd',
    payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'credits', 'one_time')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
    credits_purchased INTEGER DEFAULT 0,
    subscription_plan TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_anonymous_users_fingerprint ON public.anonymous_users(fingerprint);
CREATE INDEX IF NOT EXISTS idx_anonymous_users_daily_reset ON public.anonymous_users(daily_reset_at);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_anonymous_id ON public.generations(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON public.generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- =====================================================
-- 3. CREATE FUNCTIONS
-- =====================================================

-- Function to handle user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, credits)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        15  -- 5 free + 10 registration bonus
    );
    
    -- Record the registration bonus
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.id, 15, 'bonus', 'Registration bonus: 5 free + 10 welcome credits');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits for generation
CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_user_id UUID,
    p_generation_id UUID,
    p_credits INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    -- Get current credits with row lock
    SELECT credits INTO current_credits
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Check if user has enough credits
    IF current_credits < p_credits THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits
    UPDATE public.profiles
    SET credits = credits - p_credits,
        total_generations = total_generations + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Record transaction
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, generation_id)
    VALUES (p_user_id, -p_credits, 'generation', 'Image generation', p_generation_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits
CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_credits INTEGER,
    p_transaction_type TEXT,
    p_description TEXT DEFAULT NULL,
    p_payment_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Add credits to user
    UPDATE public.profiles
    SET credits = credits + p_credits,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Record transaction
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, payment_id)
    VALUES (p_user_id, p_credits, p_transaction_type, p_description, p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check anonymous user limits
CREATE OR REPLACE FUNCTION public.check_anonymous_limit(
    p_fingerprint TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
    current_time TIMESTAMPTZ := NOW();
BEGIN
    -- Get or create anonymous user record
    INSERT INTO public.anonymous_users (fingerprint, ip_address)
    VALUES (p_fingerprint, p_ip_address)
    ON CONFLICT (fingerprint) 
    DO UPDATE SET 
        ip_address = EXCLUDED.ip_address,
        updated_at = NOW()
    RETURNING * INTO user_record;
    
    -- If no record found, get it
    IF user_record IS NULL THEN
        SELECT * INTO user_record
        FROM public.anonymous_users
        WHERE fingerprint = p_fingerprint;
    END IF;
    
    -- Reset daily counter if needed
    IF current_time >= user_record.daily_reset_at THEN
        UPDATE public.anonymous_users
        SET generations_used = 0,
            daily_reset_at = DATE_TRUNC('day', current_time + INTERVAL '1 day')
        WHERE fingerprint = p_fingerprint;
        user_record.generations_used := 0;
    END IF;
    
    -- Check if under limit (5 per day)
    RETURN user_record.generations_used < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record anonymous generation
CREATE OR REPLACE FUNCTION public.record_anonymous_generation(
    p_fingerprint TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.anonymous_users
    SET generations_used = generations_used + 1,
        last_generation_at = NOW()
    WHERE fingerprint = p_fingerprint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. CREATE TRIGGERS
-- =====================================================

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- 
=====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles" ON public.profiles
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Anonymous users policies (allow service role and functions to manage)
CREATE POLICY "Service role can manage anonymous users" ON public.anonymous_users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Generations policies
CREATE POLICY "Users can view own generations" ON public.generations
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "Users can insert own generations" ON public.generations
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "Service role can manage all generations" ON public.generations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Credit transactions policies
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions" ON public.credit_transactions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payments" ON public.payments
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT ON public.generations TO anon, authenticated;
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_anonymous_limit(TEXT, INET) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_anonymous_generation(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- =====================================================
-- 7. INSERT SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert sample subscription plans metadata (for reference)
INSERT INTO public.profiles (id, email, display_name, credits, subscription_status) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'demo@example.com', 'Demo User', 100, 'pro')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Verify setup
SELECT 
    'Setup completed successfully!' as status,
    COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'anonymous_users', 'generations', 'credit_transactions', 'payments');

-- Show created functions
SELECT 
    routine_name as function_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('handle_new_user', 'deduct_credits', 'add_credits', 'check_anonymous_limit', 'record_anonymous_generation');