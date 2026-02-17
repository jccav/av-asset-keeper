
-- Atomic transfer of master admin role
CREATE OR REPLACE FUNCTION public.transfer_master_admin(old_master uuid, new_master uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify old_master is currently master_admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = old_master AND role = 'master_admin') THEN
    RAISE EXCEPTION 'Caller is not master admin';
  END IF;

  -- Verify new_master is an existing admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = new_master) THEN
    RAISE EXCEPTION 'Target user is not an admin';
  END IF;

  -- Atomic update
  UPDATE public.user_roles SET role = 'master_admin' WHERE user_id = new_master;
  UPDATE public.user_roles SET role = 'admin' WHERE user_id = old_master;
END;
$$;

-- Atomic checkout operation
CREATE OR REPLACE FUNCTION public.perform_checkout(
  p_equipment_id uuid,
  p_borrower_name text,
  p_team_name text,
  p_expected_return timestamptz,
  p_notes text,
  p_pin text,
  p_quantity integer,
  p_checkout_condition_counts jsonb,
  p_new_eq_available integer,
  p_new_eq_condition text,
  p_new_eq_condition_counts jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.checkout_log (equipment_id, borrower_name, team_name, expected_return, notes, pin, quantity, checkout_condition_counts)
  VALUES (p_equipment_id, p_borrower_name, p_team_name, p_expected_return, p_notes, p_pin, p_quantity, p_checkout_condition_counts);

  UPDATE public.equipment SET
    quantity_available = p_new_eq_available,
    is_available = (p_new_eq_available > 0),
    condition = p_new_eq_condition::equipment_condition,
    condition_counts = p_new_eq_condition_counts
  WHERE id = p_equipment_id;
END;
$$;

-- Atomic merge checkout operation
CREATE OR REPLACE FUNCTION public.perform_checkout_merge(
  p_checkout_id uuid,
  p_new_quantity integer,
  p_merged_condition_counts jsonb,
  p_notes text,
  p_equipment_id uuid,
  p_new_eq_available integer,
  p_new_eq_condition text,
  p_new_eq_condition_counts jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checkout_log SET
    quantity = p_new_quantity,
    checkout_condition_counts = p_merged_condition_counts,
    notes = p_notes
  WHERE id = p_checkout_id;

  UPDATE public.equipment SET
    quantity_available = p_new_eq_available,
    is_available = (p_new_eq_available > 0),
    condition = p_new_eq_condition::equipment_condition,
    condition_counts = p_new_eq_condition_counts
  WHERE id = p_equipment_id;
END;
$$;

-- Atomic return operation
CREATE OR REPLACE FUNCTION public.perform_return(
  p_checkout_id uuid,
  p_new_qty_returned integer,
  p_fully_returned boolean,
  p_condition_on_return text,
  p_return_notes text,
  p_returned_by text,
  p_equipment_id uuid,
  p_new_eq_available integer,
  p_new_eq_condition text,
  p_new_eq_condition_counts jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checkout_log SET
    quantity_returned = p_new_qty_returned,
    return_date = CASE WHEN p_fully_returned THEN now() ELSE return_date END,
    condition_on_return = p_condition_on_return::equipment_condition,
    return_notes = p_return_notes,
    returned_by = p_returned_by
  WHERE id = p_checkout_id;

  UPDATE public.equipment SET
    quantity_available = p_new_eq_available,
    is_available = true,
    condition = p_new_eq_condition::equipment_condition,
    condition_counts = p_new_eq_condition_counts
  WHERE id = p_equipment_id;
END;
$$;
