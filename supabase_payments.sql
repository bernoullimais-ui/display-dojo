-- Database schema for Payments and Subscriptions (Updated with DROP IF EXISTS)
-- Note: dojo_settings changes:
-- ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS city TEXT;
-- ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS state TEXT;
-- ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS martial_arts TEXT[];
-- ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 1. Table definitions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, 
    status TEXT NOT NULL, 
    pagarme_subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.masterclass_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    masterclass_id UUID NOT NULL,
    pagarme_order_id TEXT,
    status TEXT NOT NULL, 
    amount INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, 
    resource_id TEXT, 
    pagarme_id TEXT,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL,
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Default Data
INSERT INTO public.platform_settings (key, value) VALUES 
('plan_prices', '{
    "STARTER": 2900,
    "PRO": 9700,
    "BUSINESS": 19700
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Policies Cleanup
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.masterclass_purchases;
DROP POLICY IF EXISTS "Everyone can view platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Master Admin Full Access Subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Master Admin Full Access Purchases" ON public.masterclass_purchases;
DROP POLICY IF EXISTS "Master Admin Full Access Payments Log" ON public.payments_log;
DROP POLICY IF EXISTS "Master Admin Full Access Platform Settings" ON public.platform_settings;

-- 3. Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 4. Re-create Policies
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Users can view their own purchases" ON public.masterclass_purchases FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Everyone can view platform settings" ON public.platform_settings FOR SELECT USING (true);

-- Master Admin Access (maiabruno@msn.com)
CREATE POLICY "Master Admin Full Access Subscriptions" ON public.subscriptions FOR ALL USING (auth.jwt() ->> 'email' = 'maiabruno@msn.com');
CREATE POLICY "Master Admin Full Access Purchases" ON public.masterclass_purchases FOR ALL USING (auth.jwt() ->> 'email' = 'maiabruno@msn.com');
CREATE POLICY "Master Admin Full Access Payments Log" ON public.payments_log FOR ALL USING (auth.jwt() ->> 'email' = 'maiabruno@msn.com');
CREATE POLICY "Master Admin Full Access Platform Settings" ON public.platform_settings FOR ALL USING (auth.jwt() ->> 'email' = 'maiabruno@msn.com');
CREATE POLICY "Master Admin Full Access Dojo Settings" ON public.dojo_settings FOR ALL USING (auth.jwt() ->> 'email' = 'maiabruno@msn.com');
