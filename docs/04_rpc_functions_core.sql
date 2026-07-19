-- ============================================================================
-- 04. CORE RPC FUNCTIONS (template set)
-- Follows the project SQL/Supabase Function Standards:
--   * SECURITY DEFINER + SET search_path TO 'public'
--   * fn_get_request_context / fn_response_success / fn_response_error
--   * tenant_id filter on every query, audit columns on every write
--   * soft delete only, user-facing RAISE EXCEPTION messages
-- Assumes existing helpers: t_request_context, fn_get_request_context,
-- fn_response_success, fn_response_error, get_current_tenant_id.
--
-- Contents:
--   Numbering : fn_get_next_doc_number (internal helper, returns text)
--   Assets    : fn_get_asset, fn_list_assets, fn_save_asset, fn_delete_asset,
--               fn_allocate_asset, fn_deallocate_asset
--   Transfers : fn_save_asset_transfer, fn_receive_asset_transfer
--   PR        : fn_get_purchase_requisition, fn_list_purchase_requisitions,
--               fn_save_purchase_requisition, fn_delete_purchase_requisition,
--               fn_submit_purchase_requisition
--   PO        : fn_get_purchase_order, fn_list_purchase_orders, fn_save_purchase_order
--   Workflow  : fn_action_workflow_step (approve / reject / return)
--   Tickets   : fn_get_ticket, fn_list_tickets, fn_save_ticket,
--               fn_assign_ticket, fn_resolve_ticket
--   Grants    : execute to authenticated, revoked from anon
-- ============================================================================


-- ============================================================================
-- NUMBERING
-- Internal helper: returns text, raises on error (callers catch and wrap).
-- Locks the series row (FOR UPDATE) to guarantee gap-free concurrent numbering.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_next_doc_number(p_doc_type text, p_fiscal_year text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_series record;
BEGIN
  v_ctx := fn_get_request_context('fn_get_next_doc_number');

  SELECT * INTO v_series
  FROM number_series
  WHERE tenant_id = v_ctx.tenant_id
    AND doc_type = p_doc_type
    AND (fiscal_year = p_fiscal_year OR (fiscal_year IS NULL AND p_fiscal_year IS NULL))
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO number_series (doc_type, prefix, fiscal_year, next_number, padding,
                               tenant_id, created_by, created_at, updated_by, updated_at)
    VALUES (p_doc_type, p_doc_type || '/', p_fiscal_year, 1, 5,
            v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
    RETURNING * INTO v_series;
  END IF;

  UPDATE number_series
  SET next_number = v_series.next_number + 1,
      updated_by  = v_ctx.caller_id,
      updated_at  = now()
  WHERE id = v_series.id;

  RETURN coalesce(v_series.prefix, '')
      || lpad(v_series.next_number::text, coalesce(v_series.padding, 5), '0');
END;
$function$;


-- ============================================================================
-- ASSETS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_asset(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_result jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_get_asset');

    SELECT to_jsonb(a)
           || jsonb_build_object(
                'category_name',  c.name,
                'location_name',  l.name,
                'condition_name', cn.name,
                'vendor_name',    v.name,
                'allocated_to_name', u.first_name || coalesce(' ' || u.last_name, ''))
    INTO v_result
    FROM assets a
    LEFT JOIN categories c  ON c.id = a.category_id
    LEFT JOIN locations l   ON l.id = a.location_id
    LEFT JOIN conditions cn ON cn.id = a.condition_id
    LEFT JOIN vendors v     ON v.id = a.vendor_id
    LEFT JOIN users u       ON u.id = a.allocated_to_user_id
    WHERE a.tenant_id = v_ctx.tenant_id
      AND a.id = p_id
      AND a.is_active = true;

    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Asset not found';
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(v_result),
      p_message := 'Retrieved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_get_asset', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_list_assets(
  p_page_index  integer DEFAULT 1,
  p_page_size   integer DEFAULT 20,
  p_search      text    DEFAULT NULL,
  p_status      text    DEFAULT NULL,
  p_category_id integer DEFAULT NULL,
  p_location_id integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_assets');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    SELECT COUNT(*) INTO v_total
    FROM assets a
    WHERE a.tenant_id = v_ctx.tenant_id
      AND a.is_active = true
      AND (p_status IS NULL OR a.status = p_status)
      AND (p_category_id IS NULL OR a.category_id = p_category_id)
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%'
                            OR a.code ILIKE '%' || p_search || '%'
                            OR a.serial_no ILIKE '%' || p_search || '%');

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT a.id, a.code, a.name, a.status, a.serial_no, a.model, a.brand,
             a.purchase_date, a.current_value, a.allocated_to_user_id,
             c.name AS category_name, l.name AS location_name
      FROM assets a
      LEFT JOIN categories c ON c.id = a.category_id
      LEFT JOIN locations l  ON l.id = a.location_id
      WHERE a.tenant_id = v_ctx.tenant_id
        AND a.is_active = true
        AND (p_status IS NULL OR a.status = p_status)
        AND (p_category_id IS NULL OR a.category_id = p_category_id)
        AND (p_location_id IS NULL OR a.location_id = p_location_id)
        AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%'
                              OR a.code ILIKE '%' || p_search || '%'
                              OR a.serial_no ILIKE '%' || p_search || '%')
      ORDER BY a.created_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_list_assets', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_save_asset(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx t_request_context;
  v_id  integer;
  v_row assets%ROWTYPE;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_asset');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF v_id IS NULL AND (p_payload->>'name') IS NULL THEN
      RAISE EXCEPTION 'name is required';
    END IF;
    IF v_id IS NULL AND (p_payload->>'category_id') IS NULL THEN
      RAISE EXCEPTION 'category_id is required';
    END IF;
    IF v_id IS NULL AND (p_payload->>'location_id') IS NULL THEN
      RAISE EXCEPTION 'location_id is required';
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO assets (
        code, name, descr, category_id, location_id, condition_id, cost_center_id,
        department_id, vendor_id, manufacturer, brand, model, serial_no, parent_id,
        item_id, asset_image, geo_location, reference_id, po_number, po_id,
        purchase_date, purchase_price, capitalization_date, capitalization_price,
        current_value, salvage_value, depreciation_method_id, useful_life_months,
        depreciation_rate_percent, depreciation_start_date, end_of_life,
        warranty_expiry_date, status, data,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        coalesce(nullif(p_payload->>'code', ''), fn_get_next_doc_number('AST')),
        p_payload->>'name',
        p_payload->>'descr',
        (p_payload->>'category_id')::integer,
        (p_payload->>'location_id')::integer,
        nullif(p_payload->>'condition_id', '')::integer,
        nullif(p_payload->>'cost_center_id', '')::integer,
        nullif(p_payload->>'department_id', '')::integer,
        nullif(p_payload->>'vendor_id', '')::integer,
        p_payload->>'manufacturer',
        p_payload->>'brand',
        p_payload->>'model',
        p_payload->>'serial_no',
        nullif(p_payload->>'parent_id', '')::integer,
        nullif(p_payload->>'item_id', '')::integer,
        p_payload->>'asset_image',
        p_payload->>'geo_location',
        p_payload->>'reference_id',
        p_payload->>'po_number',
        nullif(p_payload->>'po_id', '')::integer,
        nullif(p_payload->>'purchase_date', '')::date,
        nullif(p_payload->>'purchase_price', '')::numeric,
        nullif(p_payload->>'capitalization_date', '')::date,
        nullif(p_payload->>'capitalization_price', '')::numeric,
        coalesce(nullif(p_payload->>'current_value', '')::numeric,
                 nullif(p_payload->>'capitalization_price', '')::numeric,
                 nullif(p_payload->>'purchase_price', '')::numeric),
        coalesce(nullif(p_payload->>'salvage_value', '')::numeric, 0),
        nullif(p_payload->>'depreciation_method_id', '')::integer,
        nullif(p_payload->>'useful_life_months', '')::integer,
        nullif(p_payload->>'depreciation_rate_percent', '')::numeric,
        nullif(p_payload->>'depreciation_start_date', '')::date,
        nullif(p_payload->>'end_of_life', '')::date,
        nullif(p_payload->>'warranty_expiry_date', '')::date,
        coalesce(nullif(p_payload->>'status', ''), 'in_stock'),
        coalesce(p_payload->'data', '{}'::jsonb),
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;
    ELSE
      UPDATE assets SET
        name                  = coalesce(p_payload->>'name', name),
        descr                 = coalesce(p_payload->>'descr', descr),
        category_id           = coalesce(nullif(p_payload->>'category_id', '')::integer, category_id),
        location_id           = coalesce(nullif(p_payload->>'location_id', '')::integer, location_id),
        condition_id          = coalesce(nullif(p_payload->>'condition_id', '')::integer, condition_id),
        cost_center_id        = coalesce(nullif(p_payload->>'cost_center_id', '')::integer, cost_center_id),
        department_id         = coalesce(nullif(p_payload->>'department_id', '')::integer, department_id),
        vendor_id             = coalesce(nullif(p_payload->>'vendor_id', '')::integer, vendor_id),
        manufacturer          = coalesce(p_payload->>'manufacturer', manufacturer),
        brand                 = coalesce(p_payload->>'brand', brand),
        model                 = coalesce(p_payload->>'model', model),
        serial_no             = coalesce(p_payload->>'serial_no', serial_no),
        asset_image           = coalesce(p_payload->>'asset_image', asset_image),
        geo_location          = coalesce(p_payload->>'geo_location', geo_location),
        purchase_date         = coalesce(nullif(p_payload->>'purchase_date', '')::date, purchase_date),
        purchase_price        = coalesce(nullif(p_payload->>'purchase_price', '')::numeric, purchase_price),
        capitalization_date   = coalesce(nullif(p_payload->>'capitalization_date', '')::date, capitalization_date),
        capitalization_price  = coalesce(nullif(p_payload->>'capitalization_price', '')::numeric, capitalization_price),
        salvage_value         = coalesce(nullif(p_payload->>'salvage_value', '')::numeric, salvage_value),
        depreciation_method_id = coalesce(nullif(p_payload->>'depreciation_method_id', '')::integer, depreciation_method_id),
        useful_life_months    = coalesce(nullif(p_payload->>'useful_life_months', '')::integer, useful_life_months),
        depreciation_rate_percent = coalesce(nullif(p_payload->>'depreciation_rate_percent', '')::numeric, depreciation_rate_percent),
        end_of_life           = coalesce(nullif(p_payload->>'end_of_life', '')::date, end_of_life),
        warranty_expiry_date  = coalesce(nullif(p_payload->>'warranty_expiry_date', '')::date, warranty_expiry_date),
        status                = coalesce(nullif(p_payload->>'status', ''), status),
        data                  = coalesce(p_payload->'data', data),
        updated_by            = v_ctx.caller_id,
        updated_at            = now()
      WHERE id = v_id
        AND tenant_id = v_ctx.tenant_id
        AND is_active = true
      RETURNING * INTO v_row;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found';
      END IF;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := CASE WHEN v_id IS NULL THEN 'Asset created successfully' ELSE 'Asset updated successfully' END
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_asset', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_delete_asset(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx t_request_context;
  v_row assets%ROWTYPE;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_delete_asset');

    IF NOT v_ctx.is_admin THEN
      RAISE EXCEPTION 'You do not have permission to delete assets';
    END IF;

    SELECT * INTO v_row
    FROM assets
    WHERE tenant_id = v_ctx.tenant_id AND id = p_id AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Asset not found';
    END IF;
    IF v_row.status = 'allocated' THEN
      RAISE EXCEPTION 'Cannot delete an allocated asset. Deallocate it first';
    END IF;

    UPDATE assets
    SET is_active  = false,
        updated_by = v_ctx.caller_id,
        updated_at = now()
    WHERE id = p_id
      AND tenant_id = v_ctx.tenant_id;

    RETURN fn_response_success(
      p_data    := '[]'::jsonb,
      p_message := 'Deleted successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_delete_asset', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_allocate_asset(
  p_asset_id             integer,
  p_user_id              integer,
  p_expected_return_date date DEFAULT NULL,
  p_remarks              text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx      t_request_context;
  v_asset    assets%ROWTYPE;
  v_mtype_id integer;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_allocate_asset');

    SELECT * INTO v_asset
    FROM assets
    WHERE tenant_id = v_ctx.tenant_id AND id = p_asset_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Asset not found';
    END IF;
    IF v_asset.status NOT IN ('in_stock', 'idle') THEN
      RAISE EXCEPTION 'Asset cannot be allocated in its current status (%)', v_asset.status;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users
                   WHERE tenant_id = v_ctx.tenant_id AND id = p_user_id AND is_active = true) THEN
      RAISE EXCEPTION 'Allocation target user not found';
    END IF;

    SELECT id INTO v_mtype_id
    FROM movement_types
    WHERE tenant_id = v_ctx.tenant_id AND code = 'ALLOCATE' AND is_active = true;
    IF v_mtype_id IS NULL THEN
      RAISE EXCEPTION 'Movement type ALLOCATE is not configured';
    END IF;

    INSERT INTO asset_movements (
      asset_id, movement_type_id, movement_date, from_user_id, to_user_id,
      from_location_id, to_location_id, expected_return_date,
      condition_at_movement_id, status, remarks,
      tenant_id, created_by, created_at, updated_by, updated_at)
    VALUES (
      p_asset_id, v_mtype_id, now(), v_asset.allocated_to_user_id, p_user_id,
      v_asset.location_id, v_asset.location_id, p_expected_return_date,
      v_asset.condition_id, 'completed', p_remarks,
      v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

    UPDATE assets
    SET status                = 'allocated',
        movement_type_id      = v_mtype_id,
        allocated_to_user_id  = p_user_id,
        allocated_at          = now(),
        movement_upto_date    = p_expected_return_date,
        updated_by            = v_ctx.caller_id,
        updated_at            = now()
    WHERE id = p_asset_id
      AND tenant_id = v_ctx.tenant_id
    RETURNING * INTO v_asset;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_asset)),
      p_message := 'Asset allocated successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_allocate_asset', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_deallocate_asset(
  p_asset_id     integer,
  p_condition_id integer DEFAULT NULL,
  p_remarks      text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx      t_request_context;
  v_asset    assets%ROWTYPE;
  v_mtype_id integer;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_deallocate_asset');

    SELECT * INTO v_asset
    FROM assets
    WHERE tenant_id = v_ctx.tenant_id AND id = p_asset_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Asset not found';
    END IF;
    IF v_asset.status <> 'allocated' THEN
      RAISE EXCEPTION 'Asset is not currently allocated';
    END IF;

    SELECT id INTO v_mtype_id
    FROM movement_types
    WHERE tenant_id = v_ctx.tenant_id AND code = 'DEALLOCATE' AND is_active = true;
    IF v_mtype_id IS NULL THEN
      RAISE EXCEPTION 'Movement type DEALLOCATE is not configured';
    END IF;

    INSERT INTO asset_movements (
      asset_id, movement_type_id, movement_date, from_user_id, to_user_id,
      from_location_id, to_location_id, actual_return_date,
      condition_at_movement_id, status, remarks,
      tenant_id, created_by, created_at, updated_by, updated_at)
    VALUES (
      p_asset_id, v_mtype_id, now(), v_asset.allocated_to_user_id, NULL,
      v_asset.location_id, v_asset.location_id, current_date,
      coalesce(p_condition_id, v_asset.condition_id), 'completed', p_remarks,
      v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

    UPDATE assets
    SET status               = 'in_stock',
        movement_type_id     = v_mtype_id,
        allocated_to_user_id = NULL,
        allocated_at         = NULL,
        movement_upto_date   = NULL,
        condition_id         = coalesce(p_condition_id, condition_id),
        updated_by           = v_ctx.caller_id,
        updated_at           = now()
    WHERE id = p_asset_id
      AND tenant_id = v_ctx.tenant_id
    RETURNING * INTO v_asset;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_asset)),
      p_message := 'Asset deallocated successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_deallocate_asset', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- ASSET TRANSFERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_save_asset_transfer(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx  t_request_context;
  v_id   integer;
  v_row  asset_transfers%ROWTYPE;
  v_item jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_asset_transfer');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 AND v_id IS NULL THEN
      RAISE EXCEPTION 'At least one asset is required for a transfer';
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO asset_transfers (
        transfer_number, transfer_type, from_location_id, to_location_id,
        from_user_id, to_user_id, from_department_id, to_department_id,
        requested_by, transfer_date, expected_receipt_date, reason, status,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        fn_get_next_doc_number('TRF'),
        coalesce(nullif(p_payload->>'transfer_type', ''), 'location'),
        nullif(p_payload->>'from_location_id', '')::integer,
        nullif(p_payload->>'to_location_id', '')::integer,
        nullif(p_payload->>'from_user_id', '')::integer,
        nullif(p_payload->>'to_user_id', '')::integer,
        nullif(p_payload->>'from_department_id', '')::integer,
        nullif(p_payload->>'to_department_id', '')::integer,
        v_ctx.caller_id,
        coalesce(nullif(p_payload->>'transfer_date', '')::date, current_date),
        nullif(p_payload->>'expected_receipt_date', '')::date,
        p_payload->>'reason',
        'draft',
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;
    ELSE
      SELECT * INTO v_row
      FROM asset_transfers
      WHERE tenant_id = v_ctx.tenant_id AND id = v_id AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer not found';
      END IF;
      IF v_row.status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft transfers can be edited';
      END IF;

      UPDATE asset_transfers SET
        transfer_type         = coalesce(nullif(p_payload->>'transfer_type', ''), transfer_type),
        from_location_id      = coalesce(nullif(p_payload->>'from_location_id', '')::integer, from_location_id),
        to_location_id        = coalesce(nullif(p_payload->>'to_location_id', '')::integer, to_location_id),
        from_user_id          = coalesce(nullif(p_payload->>'from_user_id', '')::integer, from_user_id),
        to_user_id            = coalesce(nullif(p_payload->>'to_user_id', '')::integer, to_user_id),
        transfer_date         = coalesce(nullif(p_payload->>'transfer_date', '')::date, transfer_date),
        expected_receipt_date = coalesce(nullif(p_payload->>'expected_receipt_date', '')::date, expected_receipt_date),
        reason                = coalesce(p_payload->>'reason', reason),
        updated_by            = v_ctx.caller_id,
        updated_at            = now()
      WHERE id = v_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    -- replace line items (soft-delete removed, insert provided)
    IF p_payload ? 'items' THEN
      UPDATE asset_transfer_items
      SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
      WHERE transfer_id = v_row.id AND tenant_id = v_ctx.tenant_id AND is_active = true;

      FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
      LOOP
        IF NOT EXISTS (SELECT 1 FROM assets
                       WHERE tenant_id = v_ctx.tenant_id
                         AND id = (v_item->>'asset_id')::integer
                         AND is_active = true
                         AND status IN ('in_stock', 'idle', 'allocated')) THEN
          RAISE EXCEPTION 'Asset % is not available for transfer', v_item->>'asset_id';
        END IF;

        INSERT INTO asset_transfer_items (
          transfer_id, asset_id, condition_at_dispatch_id, remarks,
          tenant_id, created_by, created_at, updated_by, updated_at)
        VALUES (
          v_row.id,
          (v_item->>'asset_id')::integer,
          nullif(v_item->>'condition_at_dispatch_id', '')::integer,
          v_item->>'remarks',
          v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());
      END LOOP;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Transfer saved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_asset_transfer', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_receive_asset_transfer(p_transfer_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx      t_request_context;
  v_trf      asset_transfers%ROWTYPE;
  v_item     record;
  v_mtype_id integer;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_receive_asset_transfer');

    SELECT * INTO v_trf
    FROM asset_transfers
    WHERE tenant_id = v_ctx.tenant_id AND id = p_transfer_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transfer not found';
    END IF;
    IF v_trf.status NOT IN ('approved', 'in_transit') THEN
      RAISE EXCEPTION 'Transfer is not ready to be received (current status: %)', v_trf.status;
    END IF;

    SELECT id INTO v_mtype_id
    FROM movement_types
    WHERE tenant_id = v_ctx.tenant_id AND code = 'TRANSFER' AND is_active = true;
    IF v_mtype_id IS NULL THEN
      RAISE EXCEPTION 'Movement type TRANSFER is not configured';
    END IF;

    FOR v_item IN
      SELECT * FROM asset_transfer_items
      WHERE transfer_id = p_transfer_id
        AND tenant_id = v_ctx.tenant_id
        AND is_active = true
    LOOP
      INSERT INTO asset_movements (
        asset_id, movement_type_id, movement_date,
        from_user_id, to_user_id, from_location_id, to_location_id,
        from_department_id, to_department_id, transfer_id,
        acknowledged_by, acknowledged_at, status,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        v_item.asset_id, v_mtype_id, now(),
        v_trf.from_user_id, v_trf.to_user_id, v_trf.from_location_id, v_trf.to_location_id,
        v_trf.from_department_id, v_trf.to_department_id, p_transfer_id,
        v_ctx.caller_id, now(), 'completed',
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

      UPDATE assets
      SET location_id          = coalesce(v_trf.to_location_id, location_id),
          department_id        = coalesce(v_trf.to_department_id, department_id),
          allocated_to_user_id = CASE WHEN v_trf.transfer_type = 'user'
                                      THEN v_trf.to_user_id ELSE allocated_to_user_id END,
          status               = CASE WHEN v_trf.transfer_type = 'user' AND v_trf.to_user_id IS NOT NULL
                                      THEN 'allocated' ELSE 'in_stock' END,
          movement_type_id     = v_mtype_id,
          updated_by           = v_ctx.caller_id,
          updated_at           = now()
      WHERE id = v_item.asset_id
        AND tenant_id = v_ctx.tenant_id;

      UPDATE asset_transfer_items
      SET received = true, updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = v_item.id AND tenant_id = v_ctx.tenant_id;
    END LOOP;

    UPDATE asset_transfers
    SET status      = 'received',
        received_at = now(),
        received_by = v_ctx.caller_id,
        updated_by  = v_ctx.caller_id,
        updated_at  = now()
    WHERE id = p_transfer_id
      AND tenant_id = v_ctx.tenant_id
    RETURNING * INTO v_trf;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_trf)),
      p_message := 'Transfer received successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_receive_asset_transfer', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- PURCHASE REQUISITIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_purchase_requisition(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_result jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_get_purchase_requisition');

    SELECT to_jsonb(pr)
           || jsonb_build_object(
                'items', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.line_no)
                                   FROM purchase_requisition_items i
                                   WHERE i.pr_id = pr.id
                                     AND i.tenant_id = v_ctx.tenant_id
                                     AND i.is_active = true), '[]'::jsonb))
    INTO v_result
    FROM purchase_requisitions pr
    WHERE pr.tenant_id = v_ctx.tenant_id
      AND pr.id = p_id
      AND pr.is_active = true;

    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Purchase requisition not found';
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(v_result),
      p_message := 'Retrieved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_get_purchase_requisition', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_list_purchase_requisitions(
  p_page_index integer DEFAULT 1,
  p_page_size  integer DEFAULT 20,
  p_status     text    DEFAULT NULL,
  p_search     text    DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_purchase_requisitions');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    SELECT COUNT(*) INTO v_total
    FROM purchase_requisitions pr
    WHERE pr.tenant_id = v_ctx.tenant_id
      AND pr.is_active = true
      AND (p_status IS NULL OR pr.status = p_status)
      AND (p_search IS NULL OR pr.pr_number ILIKE '%' || p_search || '%'
                            OR pr.title ILIKE '%' || p_search || '%');

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT pr.id, pr.pr_number, pr.title, pr.status, pr.priority,
             pr.required_by_date, pr.estimated_total, pr.created_at,
             u.first_name || coalesce(' ' || u.last_name, '') AS requested_by_name,
             d.name AS department_name
      FROM purchase_requisitions pr
      LEFT JOIN users u       ON u.id = pr.requested_by
      LEFT JOIN departments d ON d.id = pr.department_id
      WHERE pr.tenant_id = v_ctx.tenant_id
        AND pr.is_active = true
        AND (p_status IS NULL OR pr.status = p_status)
        AND (p_search IS NULL OR pr.pr_number ILIKE '%' || p_search || '%'
                              OR pr.title ILIKE '%' || p_search || '%')
      ORDER BY pr.created_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_list_purchase_requisitions', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_save_purchase_requisition(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx   t_request_context;
  v_id    integer;
  v_row   purchase_requisitions%ROWTYPE;
  v_item  jsonb;
  v_line  integer := 0;
  v_total numeric(18,4) := 0;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_purchase_requisition');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF v_id IS NULL THEN
      INSERT INTO purchase_requisitions (
        pr_number, title, descr, requisition_type, requested_by, department_id,
        cost_center_id, deliver_to_location_id, required_by_date, priority,
        currency_id, status,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        fn_get_next_doc_number('PR'),
        p_payload->>'title',
        p_payload->>'descr',
        coalesce(nullif(p_payload->>'requisition_type', ''), 'purchase'),
        coalesce(nullif(p_payload->>'requested_by', '')::integer, v_ctx.caller_id),
        nullif(p_payload->>'department_id', '')::integer,
        nullif(p_payload->>'cost_center_id', '')::integer,
        nullif(p_payload->>'deliver_to_location_id', '')::integer,
        nullif(p_payload->>'required_by_date', '')::date,
        coalesce(nullif(p_payload->>'priority', ''), 'medium'),
        nullif(p_payload->>'currency_id', '')::integer,
        'draft',
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;
    ELSE
      SELECT * INTO v_row
      FROM purchase_requisitions
      WHERE tenant_id = v_ctx.tenant_id AND id = v_id AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase requisition not found';
      END IF;
      IF v_row.status NOT IN ('draft', 'returned') THEN
        RAISE EXCEPTION 'Only draft or returned requisitions can be edited';
      END IF;

      UPDATE purchase_requisitions SET
        title                  = coalesce(p_payload->>'title', title),
        descr                  = coalesce(p_payload->>'descr', descr),
        department_id          = coalesce(nullif(p_payload->>'department_id', '')::integer, department_id),
        cost_center_id         = coalesce(nullif(p_payload->>'cost_center_id', '')::integer, cost_center_id),
        deliver_to_location_id = coalesce(nullif(p_payload->>'deliver_to_location_id', '')::integer, deliver_to_location_id),
        required_by_date       = coalesce(nullif(p_payload->>'required_by_date', '')::date, required_by_date),
        priority               = coalesce(nullif(p_payload->>'priority', ''), priority),
        updated_by             = v_ctx.caller_id,
        updated_at             = now()
      WHERE id = v_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    IF p_payload ? 'items' THEN
      UPDATE purchase_requisition_items
      SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
      WHERE pr_id = v_row.id AND tenant_id = v_ctx.tenant_id AND is_active = true;

      FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
      LOOP
        v_line := v_line + 1;
        IF (v_item->>'quantity') IS NULL OR (v_item->>'quantity')::numeric <= 0 THEN
          RAISE EXCEPTION 'Line %: quantity must be greater than zero', v_line;
        END IF;

        INSERT INTO purchase_requisition_items (
          pr_id, line_no, item_id, item_descr, category_id, uom_id, quantity,
          estimated_unit_price, estimated_amount, required_by_date,
          cost_center_id, suggested_vendor_id, remarks,
          tenant_id, created_by, created_at, updated_by, updated_at)
        VALUES (
          v_row.id, v_line,
          nullif(v_item->>'item_id', '')::integer,
          v_item->>'item_descr',
          nullif(v_item->>'category_id', '')::integer,
          nullif(v_item->>'uom_id', '')::integer,
          (v_item->>'quantity')::numeric,
          nullif(v_item->>'estimated_unit_price', '')::numeric,
          coalesce(nullif(v_item->>'estimated_unit_price', '')::numeric, 0) * (v_item->>'quantity')::numeric,
          nullif(v_item->>'required_by_date', '')::date,
          nullif(v_item->>'cost_center_id', '')::integer,
          nullif(v_item->>'suggested_vendor_id', '')::integer,
          v_item->>'remarks',
          v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

        v_total := v_total + coalesce(nullif(v_item->>'estimated_unit_price', '')::numeric, 0) * (v_item->>'quantity')::numeric;
      END LOOP;

      UPDATE purchase_requisitions
      SET estimated_total = v_total,
          updated_by      = v_ctx.caller_id,
          updated_at      = now()
      WHERE id = v_row.id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Purchase requisition saved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_purchase_requisition', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_delete_purchase_requisition(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx t_request_context;
  v_row purchase_requisitions%ROWTYPE;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_delete_purchase_requisition');

    SELECT * INTO v_row
    FROM purchase_requisitions
    WHERE tenant_id = v_ctx.tenant_id AND id = p_id AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase requisition not found';
    END IF;
    IF v_row.status NOT IN ('draft', 'returned', 'rejected') THEN
      RAISE EXCEPTION 'Only draft, returned or rejected requisitions can be deleted';
    END IF;
    IF v_row.created_by <> v_ctx.caller_id AND NOT v_ctx.is_admin THEN
      RAISE EXCEPTION 'You can only delete your own requisitions';
    END IF;

    UPDATE purchase_requisitions
    SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
    WHERE id = p_id AND tenant_id = v_ctx.tenant_id;

    UPDATE purchase_requisition_items
    SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
    WHERE pr_id = p_id AND tenant_id = v_ctx.tenant_id;

    RETURN fn_response_success(
      p_data    := '[]'::jsonb,
      p_message := 'Deleted successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_delete_purchase_requisition', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_submit_purchase_requisition(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_row     purchase_requisitions%ROWTYPE;
  v_def     workflow_definitions%ROWTYPE;
  v_inst_id integer;
  v_first   integer;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_submit_purchase_requisition');

    SELECT * INTO v_row
    FROM purchase_requisitions
    WHERE tenant_id = v_ctx.tenant_id AND id = p_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase requisition not found';
    END IF;
    IF v_row.status NOT IN ('draft', 'returned') THEN
      RAISE EXCEPTION 'Requisition has already been submitted';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM purchase_requisition_items
                   WHERE pr_id = p_id AND tenant_id = v_ctx.tenant_id AND is_active = true) THEN
      RAISE EXCEPTION 'Cannot submit a requisition without line items';
    END IF;

    -- pick matching workflow: default definition for this entity, amount range in trigger_condition
    SELECT * INTO v_def
    FROM workflow_definitions
    WHERE tenant_id = v_ctx.tenant_id
      AND entity_type = 'purchase_requisition'
      AND is_active = true
      AND (trigger_condition IS NULL
           OR ((coalesce((trigger_condition->>'min_amount')::numeric, 0) <= coalesce(v_row.estimated_total, 0))
           AND (trigger_condition->>'max_amount' IS NULL
                OR (trigger_condition->>'max_amount')::numeric >= coalesce(v_row.estimated_total, 0))))
    ORDER BY is_default DESC, version DESC
    LIMIT 1;

    IF v_def.id IS NULL THEN
      -- no workflow configured -> auto-approve
      UPDATE purchase_requisitions
      SET status = 'approved', submitted_at = now(), approved_at = now(),
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = p_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    ELSE
      SELECT min(step_no) INTO v_first
      FROM workflow_steps
      WHERE workflow_definition_id = v_def.id AND is_active = true;

      INSERT INTO workflow_instances (
        workflow_definition_id, entity_type, entity_id, current_step_no,
        status, initiated_by, initiated_at,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        v_def.id, 'purchase_requisition', p_id, v_first,
        'in_progress', v_ctx.caller_id, now(),
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING id INTO v_inst_id;

      INSERT INTO workflow_actions (
        workflow_instance_id, step_no, action, action_by, comments, acted_at,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        v_inst_id, 0, 'submitted', v_ctx.caller_id, NULL, now(),
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

      UPDATE purchase_requisitions
      SET status = 'in_approval', submitted_at = now(), workflow_instance_id = v_inst_id,
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = p_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Purchase requisition submitted successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_submit_purchase_requisition', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- PURCHASE ORDERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_purchase_order(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_result jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_get_purchase_order');

    SELECT to_jsonb(po)
           || jsonb_build_object(
                'vendor_name', v.name,
                'items', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.line_no)
                                   FROM purchase_order_items i
                                   WHERE i.po_id = po.id
                                     AND i.tenant_id = v_ctx.tenant_id
                                     AND i.is_active = true), '[]'::jsonb))
    INTO v_result
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    WHERE po.tenant_id = v_ctx.tenant_id
      AND po.id = p_id
      AND po.is_active = true;

    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Purchase order not found';
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(v_result),
      p_message := 'Retrieved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_get_purchase_order', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_list_purchase_orders(
  p_page_index integer DEFAULT 1,
  p_page_size  integer DEFAULT 20,
  p_status     text    DEFAULT NULL,
  p_vendor_id  integer DEFAULT NULL,
  p_search     text    DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_purchase_orders');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    SELECT COUNT(*) INTO v_total
    FROM purchase_orders po
    WHERE po.tenant_id = v_ctx.tenant_id
      AND po.is_active = true
      AND (p_status IS NULL OR po.status = p_status)
      AND (p_vendor_id IS NULL OR po.vendor_id = p_vendor_id)
      AND (p_search IS NULL OR po.po_number ILIKE '%' || p_search || '%');

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT po.id, po.po_number, po.po_date, po.status, po.total_amount,
             po.expected_delivery_date, po.created_at,
             v.name AS vendor_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE po.tenant_id = v_ctx.tenant_id
        AND po.is_active = true
        AND (p_status IS NULL OR po.status = p_status)
        AND (p_vendor_id IS NULL OR po.vendor_id = p_vendor_id)
        AND (p_search IS NULL OR po.po_number ILIKE '%' || p_search || '%')
      ORDER BY po.created_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_list_purchase_orders', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_save_purchase_order(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx      t_request_context;
  v_id       integer;
  v_row      purchase_orders%ROWTYPE;
  v_item     jsonb;
  v_line     integer := 0;
  v_subtotal numeric(18,4) := 0;
  v_tax      numeric(18,4) := 0;
  v_disc     numeric(18,4) := 0;
  v_lt       numeric(18,4);
  v_ld       numeric(18,4);
  v_ltax     numeric(18,4);
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_purchase_order');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF v_id IS NULL AND (p_payload->>'vendor_id') IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required';
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO purchase_orders (
        po_number, po_date, po_type, vendor_id, pr_id, rfq_id, quotation_id,
        currency_id, exchange_rate, payment_terms, delivery_terms,
        ship_to_location_id, bill_to_location_id, cost_center_id,
        expected_delivery_date, terms_and_conditions, remarks, status,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        fn_get_next_doc_number('PO'),
        coalesce(nullif(p_payload->>'po_date', '')::date, current_date),
        coalesce(nullif(p_payload->>'po_type', ''), 'standard'),
        (p_payload->>'vendor_id')::integer,
        nullif(p_payload->>'pr_id', '')::integer,
        nullif(p_payload->>'rfq_id', '')::integer,
        nullif(p_payload->>'quotation_id', '')::integer,
        nullif(p_payload->>'currency_id', '')::integer,
        coalesce(nullif(p_payload->>'exchange_rate', '')::numeric, 1),
        p_payload->>'payment_terms',
        p_payload->>'delivery_terms',
        nullif(p_payload->>'ship_to_location_id', '')::integer,
        nullif(p_payload->>'bill_to_location_id', '')::integer,
        nullif(p_payload->>'cost_center_id', '')::integer,
        nullif(p_payload->>'expected_delivery_date', '')::date,
        p_payload->>'terms_and_conditions',
        p_payload->>'remarks',
        'draft',
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;
    ELSE
      SELECT * INTO v_row
      FROM purchase_orders
      WHERE tenant_id = v_ctx.tenant_id AND id = v_id AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order not found';
      END IF;
      IF v_row.status NOT IN ('draft', 'returned') THEN
        RAISE EXCEPTION 'Only draft or returned purchase orders can be edited';
      END IF;

      UPDATE purchase_orders SET
        vendor_id              = coalesce(nullif(p_payload->>'vendor_id', '')::integer, vendor_id),
        po_date                = coalesce(nullif(p_payload->>'po_date', '')::date, po_date),
        currency_id            = coalesce(nullif(p_payload->>'currency_id', '')::integer, currency_id),
        exchange_rate          = coalesce(nullif(p_payload->>'exchange_rate', '')::numeric, exchange_rate),
        payment_terms          = coalesce(p_payload->>'payment_terms', payment_terms),
        delivery_terms         = coalesce(p_payload->>'delivery_terms', delivery_terms),
        ship_to_location_id    = coalesce(nullif(p_payload->>'ship_to_location_id', '')::integer, ship_to_location_id),
        expected_delivery_date = coalesce(nullif(p_payload->>'expected_delivery_date', '')::date, expected_delivery_date),
        terms_and_conditions   = coalesce(p_payload->>'terms_and_conditions', terms_and_conditions),
        remarks                = coalesce(p_payload->>'remarks', remarks),
        updated_by             = v_ctx.caller_id,
        updated_at             = now()
      WHERE id = v_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    IF p_payload ? 'items' THEN
      UPDATE purchase_order_items
      SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
      WHERE po_id = v_row.id AND tenant_id = v_ctx.tenant_id AND is_active = true;

      FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
      LOOP
        v_line := v_line + 1;
        IF (v_item->>'quantity') IS NULL OR (v_item->>'quantity')::numeric <= 0 THEN
          RAISE EXCEPTION 'Line %: quantity must be greater than zero', v_line;
        END IF;
        IF (v_item->>'unit_price') IS NULL OR (v_item->>'unit_price')::numeric < 0 THEN
          RAISE EXCEPTION 'Line %: unit_price is required', v_line;
        END IF;

        v_lt   := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
        v_ld   := v_lt * coalesce(nullif(v_item->>'discount_percent', '')::numeric, 0) / 100;
        v_ltax := (v_lt - v_ld)
                  * coalesce((SELECT rate_percent FROM tax_codes
                              WHERE tenant_id = v_ctx.tenant_id
                                AND id = nullif(v_item->>'tax_code_id', '')::integer
                                AND is_active = true), 0) / 100;

        INSERT INTO purchase_order_items (
          po_id, line_no, pr_item_id, quotation_item_id, item_id, item_descr,
          uom_id, quantity, unit_price, discount_percent, discount_amount,
          tax_code_id, tax_amount, line_total, expected_delivery_date,
          cost_center_id, remarks,
          tenant_id, created_by, created_at, updated_by, updated_at)
        VALUES (
          v_row.id, v_line,
          nullif(v_item->>'pr_item_id', '')::integer,
          nullif(v_item->>'quotation_item_id', '')::integer,
          nullif(v_item->>'item_id', '')::integer,
          v_item->>'item_descr',
          nullif(v_item->>'uom_id', '')::integer,
          (v_item->>'quantity')::numeric,
          (v_item->>'unit_price')::numeric,
          coalesce(nullif(v_item->>'discount_percent', '')::numeric, 0),
          v_ld,
          nullif(v_item->>'tax_code_id', '')::integer,
          v_ltax,
          v_lt - v_ld + v_ltax,
          nullif(v_item->>'expected_delivery_date', '')::date,
          nullif(v_item->>'cost_center_id', '')::integer,
          v_item->>'remarks',
          v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

        v_subtotal := v_subtotal + v_lt;
        v_disc     := v_disc + v_ld;
        v_tax      := v_tax + v_ltax;
      END LOOP;

      UPDATE purchase_orders
      SET subtotal        = v_subtotal,
          discount_amount = v_disc,
          tax_amount      = v_tax,
          total_amount    = v_subtotal - v_disc + v_tax
                            + coalesce(freight_amount, 0) + coalesce(other_charges, 0),
          updated_by      = v_ctx.caller_id,
          updated_at      = now()
      WHERE id = v_row.id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Purchase order saved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_purchase_order', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- WORKFLOW — generic approve / reject / return for any document
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_action_workflow_step(
  p_instance_id integer,
  p_action      text,               -- 'approved' | 'rejected' | 'returned'
  p_comments    text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx        t_request_context;
  v_inst       workflow_instances%ROWTYPE;
  v_step       workflow_steps%ROWTYPE;
  v_next       integer;
  v_can_act    boolean := false;
  v_doc_status text;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_action_workflow_step');

    IF p_action NOT IN ('approved', 'rejected', 'returned') THEN
      RAISE EXCEPTION 'Invalid action. Allowed: approved, rejected, returned';
    END IF;

    SELECT * INTO v_inst
    FROM workflow_instances
    WHERE tenant_id = v_ctx.tenant_id AND id = p_instance_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Workflow instance not found';
    END IF;
    IF v_inst.status <> 'in_progress' THEN
      RAISE EXCEPTION 'This workflow has already been completed';
    END IF;

    SELECT * INTO v_step
    FROM workflow_steps
    WHERE workflow_definition_id = v_inst.workflow_definition_id
      AND step_no = v_inst.current_step_no
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Current workflow step not found';
    END IF;

    -- authorisation: admin, named approver, role approver, or active delegate
    v_can_act := v_ctx.is_admin
      OR (v_step.approver_type = 'user' AND v_step.approver_user_id = v_ctx.caller_id)
      OR (v_step.approver_type = 'role' AND v_step.approver_role_id = ANY (v_ctx.role_ids))
      OR EXISTS (
           SELECT 1 FROM approval_delegations d
           WHERE d.tenant_id = v_ctx.tenant_id
             AND d.to_user_id = v_ctx.caller_id
             AND d.from_user_id = v_step.approver_user_id
             AND (d.entity_type IS NULL OR d.entity_type = v_inst.entity_type)
             AND current_date BETWEEN d.from_date AND d.to_date
             AND d.is_active = true);

    IF NOT v_can_act THEN
      RAISE EXCEPTION 'You are not authorised to act on this approval step';
    END IF;

    INSERT INTO workflow_actions (
      workflow_instance_id, workflow_step_id, step_no, action, action_by,
      comments, acted_at,
      tenant_id, created_by, created_at, updated_by, updated_at)
    VALUES (
      p_instance_id, v_step.id, v_step.step_no, p_action, v_ctx.caller_id,
      p_comments, now(),
      v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

    IF p_action = 'approved' THEN
      SELECT min(step_no) INTO v_next
      FROM workflow_steps
      WHERE workflow_definition_id = v_inst.workflow_definition_id
        AND step_no > v_inst.current_step_no
        AND is_active = true;

      IF v_next IS NOT NULL THEN
        UPDATE workflow_instances
        SET current_step_no = v_next, updated_by = v_ctx.caller_id, updated_at = now()
        WHERE id = p_instance_id AND tenant_id = v_ctx.tenant_id
        RETURNING * INTO v_inst;

        RETURN fn_response_success(
          p_data    := jsonb_build_array(to_jsonb(v_inst)),
          p_message := 'Approved. Moved to next approval step'
        );
      END IF;
      v_doc_status := 'approved';
    ELSIF p_action = 'rejected' THEN
      v_doc_status := 'rejected';
    ELSE
      v_doc_status := 'returned';
    END IF;

    -- finalise instance
    UPDATE workflow_instances
    SET status = v_doc_status, completed_at = now(),
        updated_by = v_ctx.caller_id, updated_at = now()
    WHERE id = p_instance_id AND tenant_id = v_ctx.tenant_id
    RETURNING * INTO v_inst;

    -- propagate status to the underlying document
    IF v_inst.entity_type = 'purchase_requisition' THEN
      UPDATE purchase_requisitions
      SET status = v_doc_status,
          approved_at = CASE WHEN v_doc_status = 'approved' THEN now() END,
          rejection_reason = CASE WHEN v_doc_status = 'rejected' THEN p_comments END,
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = v_inst.entity_id AND tenant_id = v_ctx.tenant_id;
    ELSIF v_inst.entity_type = 'purchase_order' THEN
      UPDATE purchase_orders
      SET status = v_doc_status,
          approved_at = CASE WHEN v_doc_status = 'approved' THEN now() END,
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = v_inst.entity_id AND tenant_id = v_ctx.tenant_id;
    ELSIF v_inst.entity_type = 'asset_transfer' THEN
      UPDATE asset_transfers
      SET status = CASE WHEN v_doc_status = 'approved' THEN 'approved' ELSE v_doc_status END,
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = v_inst.entity_id AND tenant_id = v_ctx.tenant_id;
    ELSIF v_inst.entity_type = 'asset_disposal' THEN
      UPDATE asset_disposals
      SET status = v_doc_status,
          approved_at = CASE WHEN v_doc_status = 'approved' THEN now() END,
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = v_inst.entity_id AND tenant_id = v_ctx.tenant_id;
    ELSIF v_inst.entity_type = 'purchase_invoice' THEN
      UPDATE purchase_invoices
      SET status = v_doc_status,
          updated_by = v_ctx.caller_id, updated_at = now()
      WHERE id = v_inst.entity_id AND tenant_id = v_ctx.tenant_id;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_inst)),
      p_message := 'Workflow ' || v_doc_status || ' successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_action_workflow_step', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- TICKETS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_ticket(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_result jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_get_ticket');

    SELECT to_jsonb(t)
           || jsonb_build_object(
                'asset_name', a.name,
                'asset_code', a.code,
                'comments', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at)
                                      FROM ticket_comments c
                                      WHERE c.ticket_id = t.id
                                        AND c.tenant_id = v_ctx.tenant_id
                                        AND c.is_active = true
                                        AND (c.is_internal = false
                                             OR t.assigned_to = v_ctx.caller_id
                                             OR v_ctx.is_admin)), '[]'::jsonb))
    INTO v_result
    FROM tickets t
    LEFT JOIN assets a ON a.id = t.asset_id
    WHERE t.tenant_id = v_ctx.tenant_id
      AND t.id = p_id
      AND t.is_active = true;

    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Ticket not found';
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(v_result),
      p_message := 'Retrieved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_get_ticket', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_list_tickets(
  p_page_index  integer DEFAULT 1,
  p_page_size   integer DEFAULT 20,
  p_status      text    DEFAULT NULL,
  p_priority    text    DEFAULT NULL,
  p_asset_id    integer DEFAULT NULL,
  p_assigned_to integer DEFAULT NULL,
  p_my_tickets  boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_tickets');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    SELECT COUNT(*) INTO v_total
    FROM tickets t
    WHERE t.tenant_id = v_ctx.tenant_id
      AND t.is_active = true
      AND (p_status IS NULL OR t.status = p_status)
      AND (p_priority IS NULL OR t.priority = p_priority)
      AND (p_asset_id IS NULL OR t.asset_id = p_asset_id)
      AND (p_assigned_to IS NULL OR t.assigned_to = p_assigned_to)
      AND (NOT p_my_tickets OR t.raised_by = v_ctx.caller_id OR t.assigned_to = v_ctx.caller_id);

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT t.id, t.ticket_number, t.subject, t.status, t.priority, t.severity,
             t.resolution_due_at, t.is_sla_breached, t.created_at,
             a.code AS asset_code, a.name AS asset_name,
             ru.first_name || coalesce(' ' || ru.last_name, '') AS raised_by_name,
             au.first_name || coalesce(' ' || au.last_name, '') AS assigned_to_name
      FROM tickets t
      LEFT JOIN assets a ON a.id = t.asset_id
      LEFT JOIN users ru ON ru.id = t.raised_by
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE t.tenant_id = v_ctx.tenant_id
        AND t.is_active = true
        AND (p_status IS NULL OR t.status = p_status)
        AND (p_priority IS NULL OR t.priority = p_priority)
        AND (p_asset_id IS NULL OR t.asset_id = p_asset_id)
        AND (p_assigned_to IS NULL OR t.assigned_to = p_assigned_to)
        AND (NOT p_my_tickets OR t.raised_by = v_ctx.caller_id OR t.assigned_to = v_ctx.caller_id)
      ORDER BY t.created_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_list_tickets', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_save_ticket(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx t_request_context;
  v_id  integer;
  v_row tickets%ROWTYPE;
  v_sla sla_policies%ROWTYPE;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_ticket');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF v_id IS NULL AND (p_payload->>'subject') IS NULL THEN
      RAISE EXCEPTION 'subject is required';
    END IF;

    IF v_id IS NULL THEN
      -- resolve SLA from priority
      SELECT * INTO v_sla
      FROM sla_policies
      WHERE tenant_id = v_ctx.tenant_id
        AND priority = coalesce(nullif(p_payload->>'priority', ''), 'medium')
        AND is_active = true
      ORDER BY id
      LIMIT 1;

      INSERT INTO tickets (
        ticket_number, subject, descr, ticket_type, asset_id, category_id,
        location_id, raised_by, raised_on_behalf_of, channel, priority, severity,
        impact, status, sla_policy_id, response_due_at, resolution_due_at,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        fn_get_next_doc_number('TKT'),
        p_payload->>'subject',
        p_payload->>'descr',
        coalesce(nullif(p_payload->>'ticket_type', ''), 'incident'),
        nullif(p_payload->>'asset_id', '')::integer,
        nullif(p_payload->>'category_id', '')::integer,
        nullif(p_payload->>'location_id', '')::integer,
        v_ctx.caller_id,
        nullif(p_payload->>'raised_on_behalf_of', '')::integer,
        coalesce(nullif(p_payload->>'channel', ''), 'web'),
        coalesce(nullif(p_payload->>'priority', ''), 'medium'),
        p_payload->>'severity',
        p_payload->>'impact',
        'open',
        v_sla.id,
        CASE WHEN v_sla.id IS NOT NULL THEN now() + (v_sla.response_time_minutes || ' minutes')::interval END,
        CASE WHEN v_sla.id IS NOT NULL THEN now() + (v_sla.resolution_time_minutes || ' minutes')::interval END,
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;

      INSERT INTO ticket_activities (
        ticket_id, activity_type, to_value, performed_by, performed_at,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        v_row.id, 'status_change', 'open', v_ctx.caller_id, now(),
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());
    ELSE
      SELECT * INTO v_row
      FROM tickets
      WHERE tenant_id = v_ctx.tenant_id AND id = v_id AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found';
      END IF;
      IF v_row.status IN ('closed', 'cancelled') THEN
        RAISE EXCEPTION 'Closed or cancelled tickets cannot be edited';
      END IF;

      UPDATE tickets SET
        subject     = coalesce(p_payload->>'subject', subject),
        descr       = coalesce(p_payload->>'descr', descr),
        asset_id    = coalesce(nullif(p_payload->>'asset_id', '')::integer, asset_id),
        category_id = coalesce(nullif(p_payload->>'category_id', '')::integer, category_id),
        priority    = coalesce(nullif(p_payload->>'priority', ''), priority),
        severity    = coalesce(p_payload->>'severity', severity),
        impact      = coalesce(p_payload->>'impact', impact),
        updated_by  = v_ctx.caller_id,
        updated_at  = now()
      WHERE id = v_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := CASE WHEN v_id IS NULL THEN 'Ticket created successfully' ELSE 'Ticket updated successfully' END
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_ticket', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_assign_ticket(p_ticket_id integer, p_user_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx t_request_context;
  v_row tickets%ROWTYPE;
  v_old integer;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_assign_ticket');

    SELECT * INTO v_row
    FROM tickets
    WHERE tenant_id = v_ctx.tenant_id AND id = p_ticket_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket not found';
    END IF;
    IF v_row.status IN ('resolved', 'closed', 'cancelled') THEN
      RAISE EXCEPTION 'Ticket cannot be assigned in its current status (%)', v_row.status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users
                   WHERE tenant_id = v_ctx.tenant_id AND id = p_user_id AND is_active = true) THEN
      RAISE EXCEPTION 'Assignee user not found';
    END IF;

    v_old := v_row.assigned_to;

    UPDATE tickets
    SET assigned_to = p_user_id,
        assigned_at = now(),
        status      = CASE WHEN status = 'open' THEN 'assigned' ELSE status END,
        updated_by  = v_ctx.caller_id,
        updated_at  = now()
    WHERE id = p_ticket_id AND tenant_id = v_ctx.tenant_id
    RETURNING * INTO v_row;

    INSERT INTO ticket_activities (
      ticket_id, activity_type, from_value, to_value, performed_by, performed_at,
      tenant_id, created_by, created_at, updated_by, updated_at)
    VALUES (
      p_ticket_id, 'assignment', v_old::text, p_user_id::text, v_ctx.caller_id, now(),
      v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Ticket assigned successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_assign_ticket', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_resolve_ticket(p_ticket_id integer, p_resolution_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx t_request_context;
  v_row tickets%ROWTYPE;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_resolve_ticket');

    IF p_resolution_notes IS NULL OR btrim(p_resolution_notes) = '' THEN
      RAISE EXCEPTION 'resolution_notes is required';
    END IF;

    SELECT * INTO v_row
    FROM tickets
    WHERE tenant_id = v_ctx.tenant_id AND id = p_ticket_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket not found';
    END IF;
    IF v_row.status IN ('resolved', 'closed', 'cancelled') THEN
      RAISE EXCEPTION 'Ticket is already resolved or closed';
    END IF;
    IF v_row.assigned_to <> v_ctx.caller_id AND NOT v_ctx.is_admin THEN
      RAISE EXCEPTION 'Only the assigned user can resolve this ticket';
    END IF;

    UPDATE tickets
    SET status           = 'resolved',
        resolved_at      = now(),
        resolved_by      = v_ctx.caller_id,
        resolution_notes = p_resolution_notes,
        is_sla_breached  = CASE WHEN resolution_due_at IS NOT NULL AND now() > resolution_due_at
                                THEN true ELSE is_sla_breached END,
        updated_by       = v_ctx.caller_id,
        updated_at       = now()
    WHERE id = p_ticket_id AND tenant_id = v_ctx.tenant_id
    RETURNING * INTO v_row;

    INSERT INTO ticket_activities (
      ticket_id, activity_type, from_value, to_value, performed_by, performed_at, remarks,
      tenant_id, created_by, created_at, updated_by, updated_at)
    VALUES (
      p_ticket_id, 'status_change', 'in_progress', 'resolved', v_ctx.caller_id, now(), p_resolution_notes,
      v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Ticket resolved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_resolve_ticket', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- GRANTS — expose to authenticated only; internal helper locked down
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.fn_get_next_doc_number(text, text) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'fn_get_asset(integer)',
    'fn_list_assets(integer,integer,text,text,integer,integer)',
    'fn_save_asset(jsonb)',
    'fn_delete_asset(integer)',
    'fn_allocate_asset(integer,integer,date,text)',
    'fn_deallocate_asset(integer,integer,text)',
    'fn_save_asset_transfer(jsonb)',
    'fn_receive_asset_transfer(integer)',
    'fn_get_purchase_requisition(integer)',
    'fn_list_purchase_requisitions(integer,integer,text,text)',
    'fn_save_purchase_requisition(jsonb)',
    'fn_delete_purchase_requisition(integer)',
    'fn_submit_purchase_requisition(integer)',
    'fn_get_purchase_order(integer)',
    'fn_list_purchase_orders(integer,integer,text,integer,text)',
    'fn_save_purchase_order(jsonb)',
    'fn_action_workflow_step(integer,text,text)',
    'fn_get_ticket(integer)',
    'fn_list_tickets(integer,integer,text,text,integer,integer,boolean)',
    'fn_save_ticket(jsonb)',
    'fn_assign_ticket(integer,integer)',
    'fn_resolve_ticket(integer,text)'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- ============================================================================
-- END 04
-- ============================================================================
