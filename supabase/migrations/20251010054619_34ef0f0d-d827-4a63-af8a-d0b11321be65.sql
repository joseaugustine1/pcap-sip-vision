-- Fix function search path security issue
CREATE OR REPLACE FUNCTION prevent_null_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;