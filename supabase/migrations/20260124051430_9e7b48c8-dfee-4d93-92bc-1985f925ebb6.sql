-- Add explanation_style to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS explanation_style text DEFAULT 'five_year_old';

-- Create study_requests table for friend/study mate requests
CREATE TABLE public.study_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

-- Create study_mates table for accepted connections
CREATE TABLE public.study_mates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mate_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, mate_id)
);

-- Create study_groups table
CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  admin_id uuid NOT NULL,
  field_of_study text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create study_group_members table
CREATE TABLE public.study_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.study_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Add star_rating to user_settings (based on quiz performance)
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS star_rating numeric(2,1) DEFAULT 0 CHECK (star_rating >= 0 AND star_rating <= 5);

-- Enable RLS on all new tables
ALTER TABLE public.study_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_mates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for study_requests
CREATE POLICY "Users can view their own requests" ON public.study_requests
FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create requests" ON public.study_requests
FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update requests sent to them" ON public.study_requests
FOR UPDATE USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete their own requests" ON public.study_requests
FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- RLS Policies for study_mates
CREATE POLICY "Users can view their study mates" ON public.study_mates
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = mate_id);

CREATE POLICY "Users can add study mates" ON public.study_mates
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove study mates" ON public.study_mates
FOR DELETE USING (auth.uid() = user_id OR auth.uid() = mate_id);

-- RLS Policies for study_groups
CREATE POLICY "Anyone can view study groups" ON public.study_groups
FOR SELECT USING (true);

CREATE POLICY "Users can create study groups" ON public.study_groups
FOR INSERT WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update their groups" ON public.study_groups
FOR UPDATE USING (auth.uid() = admin_id);

CREATE POLICY "Admins can delete their groups" ON public.study_groups
FOR DELETE USING (auth.uid() = admin_id);

-- RLS Policies for study_group_members
CREATE POLICY "Anyone can view group members" ON public.study_group_members
FOR SELECT USING (true);

CREATE POLICY "Group admins can add members" ON public.study_group_members
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.study_groups WHERE id = group_id AND admin_id = auth.uid())
  OR auth.uid() = user_id
);

CREATE POLICY "Group admins or self can remove members" ON public.study_group_members
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.study_groups WHERE id = group_id AND admin_id = auth.uid())
  OR auth.uid() = user_id
);

-- Make profiles publicly viewable for community features
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Profiles are publicly viewable" ON public.profiles
FOR SELECT USING (true);

-- Make user_settings publicly viewable for community (star rating, field of study)
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Settings are publicly viewable" ON public.user_settings
FOR SELECT USING (true);

-- Update timestamp trigger for new tables
CREATE TRIGGER update_study_requests_updated_at
BEFORE UPDATE ON public.study_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_study_groups_updated_at
BEFORE UPDATE ON public.study_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();