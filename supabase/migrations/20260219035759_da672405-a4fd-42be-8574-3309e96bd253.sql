
-- Update perform_checkout to accept new fields
CREATE OR REPLACE FUNCTION public.perform_checkout(
  p_equipment_id uuid, p_borrower_name text, p_team_name text, p_expected_return timestamp with time zone,
  p_notes text, p_pin text, p_quantity integer, p_checkout_condition_counts jsonb,
  p_new_eq_available integer, p_new_eq_condition text, p_new_eq_condition_counts jsonb,
  p_contact_number text DEFAULT NULL, p_location_used text DEFAULT NULL, p_av_member text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.checkout_log (equipment_id, borrower_name, team_name, expected_return, notes, pin, quantity, checkout_condition_counts, contact_number, location_used, av_member)
  VALUES (p_equipment_id, p_borrower_name, p_team_name, p_expected_return, p_notes, p_pin, p_quantity, p_checkout_condition_counts, p_contact_number, p_location_used, p_av_member);

  UPDATE public.equipment SET
    quantity_available = p_new_eq_available,
    is_available = (p_new_eq_available > 0),
    condition = p_new_eq_condition::equipment_condition,
    condition_counts = p_new_eq_condition_counts
  WHERE id = p_equipment_id;
END;
$$;
