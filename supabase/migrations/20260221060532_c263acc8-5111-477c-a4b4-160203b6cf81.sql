-- Create function to increment star rating (capped at 5)
CREATE OR REPLACE FUNCTION public.increment_star_rating(_user_id UUID, _amount NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE public.user_settings
  SET star_rating = LEAST(5, COALESCE(star_rating, 0) + _amount),
      updated_at = now()
  WHERE user_id = _user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;