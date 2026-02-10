
-- Create enum for equipment condition
CREATE TYPE public.equipment_condition AS ENUM ('good', 'fair', 'damaged');

-- Create enum for equipment category
CREATE TYPE public.equipment_category AS ENUM ('audio', 'video', 'lighting', 'presentation', 'cables_accessories');

-- Create enum for admin roles
CREATE TYPE public.app_role AS ENUM ('admin', 'master_admin');

-- Equipment table
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category public.equipment_category NOT NULL DEFAULT 'audio',
  condition public.equipment_condition NOT NULL DEFAULT 'good',
  notes TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_retired BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checkout log table
CREATE TABLE public.checkout_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  team_name TEXT,
  checkout_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return TIMESTAMPTZ,
  return_date TIMESTAMPTZ,
  condition_on_return public.equipment_condition,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Profiles table for admin display info
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer functions for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (role = 'admin' OR role = 'master_admin')
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- EQUIPMENT POLICIES
-- Everyone can view non-retired equipment
CREATE POLICY "Anyone can view equipment"
  ON public.equipment FOR SELECT
  USING (is_retired = false);

-- Admins can insert equipment
CREATE POLICY "Admins can insert equipment"
  ON public.equipment FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can update equipment
CREATE POLICY "Admins can update equipment"
  ON public.equipment FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can delete equipment
CREATE POLICY "Admins can delete equipment"
  ON public.equipment FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- CHECKOUT LOG POLICIES
-- Anyone can view checkout logs (for return flow - finding their checkout)
CREATE POLICY "Anyone can view checkout logs"
  ON public.checkout_log FOR SELECT
  USING (true);

-- Anyone can create a checkout
CREATE POLICY "Anyone can create checkout"
  ON public.checkout_log FOR INSERT
  WITH CHECK (true);

-- Anyone can update checkout (for returns)
CREATE POLICY "Anyone can update checkout"
  ON public.checkout_log FOR UPDATE
  USING (return_date IS NULL);

-- USER ROLES POLICIES
-- Only admins can view roles
CREATE POLICY "Admins can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Master admin can manage roles (insert/delete handled via edge function with service role)

-- PROFILES POLICIES
-- Admins can view all profiles
CREATE POLICY "Admins can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Users can view own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_equipment_category ON public.equipment(category);
CREATE INDEX idx_equipment_available ON public.equipment(is_available);
CREATE INDEX idx_checkout_log_equipment ON public.checkout_log(equipment_id);
CREATE INDEX idx_checkout_log_return ON public.checkout_log(return_date);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
