-- ============================================================================
-- The Ciprian Company · Métricas Cipriano
-- Esquema completo para Supabase (PostgreSQL + pgcrypto + RLS + RPCs DSB)
-- Ejecutar completo en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Configuración general de la campaña y estética
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id text primary key default 'default',
  advisor_name text not null default 'Jose Miguel Ciprian',
  host_title text not null default 'The Ciprian Company',
  brand_subtitle text not null default 'The Ciprian Company · Show de Cocina',
  default_ticket_amount numeric not null default 2792,
  require_pin boolean not null default false,
  pin_code text not null default '2026',
  gift_theme text not null default 'autumn',
  custom_box_color text not null default '#C88A2B',
  showcase_style text not null default 'luminous-gold',
  randomize_gifts boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.app_settings add column if not exists gift_theme text not null default 'autumn';
alter table public.app_settings add column if not exists custom_box_color text not null default '#C88A2B';
alter table public.app_settings add column if not exists showcase_style text not null default 'luminous-gold';
alter table public.app_settings add column if not exists randomize_gifts boolean not null default true;

-- ----------------------------------------------------------------------------
-- 2. Catálogo de obsequios exclusivos
-- ----------------------------------------------------------------------------
create table if not exists public.gifts (
  id text primary key,
  name text not null,
  subtitle text not null default '',
  usage_tip text not null default '',
  tag text not null default '',
  visual_key text not null default 'cutlery',
  custom_image_url text,
  accent_color text not null default '#C88A2B',
  active boolean not null default true,
  stock_label text not null default 'Disponible',
  probability numeric not null default 11.1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gifts add column if not exists usage_tip text not null default '';
alter table public.gifts add column if not exists probability numeric not null default 11.1;

create index if not exists gifts_sort_order_idx on public.gifts (sort_order asc, created_at asc);

-- ----------------------------------------------------------------------------
-- 3. Prospectos y respuestas de cualificación Royal Prestige
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id text primary key,
  name text not null,
  phone text not null,
  address text not null default '',
  accepted_terms boolean not null default true,
  gift_id text,
  gift_name text,
  gift_visual_key text,
  claim_code text not null,
  called boolean not null default false,
  called_at timestamptz,
  category text not null default 'none',
  order_amount numeric,
  notes text not null default '',
  qualification jsonb,
  promo_code_invalidated boolean not null default false,
  promo_code_invalidated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.leads add column if not exists promo_code_invalidated boolean not null default false;
alter table public.leads add column if not exists promo_code_invalidated_at timestamptz;

update public.leads
set promo_code_invalidated = true,
    promo_code_invalidated_at = coalesce(promo_code_invalidated_at, called_at, created_at, now())
where category in ('cita', 'demo', 'orden')
  and promo_code_invalidated = false;

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Bóveda de autenticación 2FA del DSB (acceso exclusivo vía RPC SECURITY DEFINER)
-- ----------------------------------------------------------------------------
create table if not exists public.dsb_auth (
  id text primary key default 'default',
  username text not null,
  role text not null default 'admin',
  password_hash text not null,
  pin_hash text not null,
  master_hash text not null,
  failed_login_attempts int not null default 0,
  login_locked_until timestamptz,
  failed_pin_attempts int not null default 0,
  pin_locked_until timestamptz,
  failed_master_attempts int not null default 0,
  master_locked_until timestamptz,
  pre_auth_token text,
  pre_auth_expires_at timestamptz,
  session_token text,
  session_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.dsb_auth add column if not exists role text not null default 'admin';

-- ----------------------------------------------------------------------------
-- 4b. Códigos QR del Estudio QR (acceso exclusivo admin / service_role)
-- ----------------------------------------------------------------------------
create table if not exists public.qr_codes (
  id text primary key,
  name text not null,
  target_url text not null,
  style_id text not null default 'classic-gold',
  dot_shape text not null default 'rounded',
  foreground_color text not null default '#22150E',
  background_color text not null default '#FFFDF9',
  include_logo boolean not null default true,
  frame_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists qr_codes_created_at_idx on public.qr_codes (created_at desc);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.gifts enable row level security;
alter table public.leads enable row level security;
alter table public.dsb_auth enable row level security;
alter table public.qr_codes enable row level security;

-- Revocar acceso directo desde cliente a tablas sensibles
revoke all on table public.dsb_auth from anon, authenticated, public;
revoke all on table public.leads from anon, public;
revoke all on table public.qr_codes from anon, public;
revoke all on table public.qr_codes from authenticated;

drop policy if exists "app_settings_public_access" on public.app_settings;
create policy "app_settings_public_access"
  on public.app_settings
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "gifts_public_access" on public.gifts;
create policy "gifts_public_access"
  on public.gifts
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "leads_public_access" on public.leads;
create policy "leads_service_only"
  on public.leads
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "qr_codes_service_only" on public.qr_codes;
create policy "qr_codes_service_only"
  on public.qr_codes
  for all
  to service_role
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.app_settings, public.gifts to anon, authenticated;
grant all on public.app_settings, public.gifts, public.leads, public.dsb_auth, public.qr_codes to service_role;

-- ----------------------------------------------------------------------------
-- 6. Funciones RPC de seguridad (2FA: Usuario/Clave + PIN Caja Fuerte + Llave Maestra)
-- ----------------------------------------------------------------------------
create or replace function public.dsb_verify_secret_hash(
  p_plain text,
  p_stored_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_salt text;
  v_hex text;
begin
  if p_stored_hash is null or p_stored_hash = '' then
    return false;
  end if;

  if p_stored_hash like 'sha256$%' then
    v_salt := split_part(p_stored_hash, '$', 2);
    v_hex := split_part(p_stored_hash, '$', 3);
    return encode(digest(convert_to(v_salt || ':' || coalesce(p_plain, ''), 'UTF8'), 'sha256'), 'hex') = v_hex;
  end if;

  return p_stored_hash = crypt(coalesce(p_plain, ''), p_stored_hash);
end;
$$;

revoke all on function public.dsb_verify_secret_hash(text, text) from anon, authenticated, public;
grant execute on function public.dsb_verify_secret_hash(text, text) to service_role;

create or replace function public.dsb_verify_admin_password(
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth public.dsb_auth%rowtype;
begin
  select * into v_auth
  from public.dsb_auth
  where id = 'default' and coalesce(role, 'admin') = 'admin';

  if not found then
    return false;
  end if;

  return public.dsb_verify_secret_hash(p_password, v_auth.password_hash);
end;
$$;

revoke all on function public.dsb_verify_admin_password(text) from anon, authenticated, public;
grant execute on function public.dsb_verify_admin_password(text) to service_role;

create or replace function public.dsb_login_step1(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth public.dsb_auth%rowtype;
  v_max_attempts constant int := 5;
  v_remaining int;
  v_retry_secs int;
  v_clean_user text := trim(coalesce(p_username, ''));
  v_user_ok boolean := false;
  v_pass_ok boolean := false;
  v_pre_token text;
begin
  if lower(v_clean_user) = 'admincripian' then
    return jsonb_build_object('ok', false, 'error', 'Credenciales incorrectas.', 'remainingAttempts', 4);
  end if;

  select * into v_auth from public.dsb_auth where lower(username) = lower(v_clean_user);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Credenciales incorrectas.', 'remainingAttempts', 4);
  end if;

  if v_auth.login_locked_until is not null and v_auth.login_locked_until > now() then
    v_retry_secs := greatest(1, ceil(extract(epoch from (v_auth.login_locked_until - now())))::int);
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'retryAfterSeconds', v_retry_secs,
      'remainingAttempts', 0,
      'error', format('Acceso bloqueado temporalmente por seguridad. Intenta nuevamente en %s segundos.', v_retry_secs)
    );
  end if;

  if v_auth.login_locked_until is not null and v_auth.login_locked_until <= now() then
    update public.dsb_auth
    set failed_login_attempts = 0, login_locked_until = null
    where id = v_auth.id;
    v_auth.failed_login_attempts := 0;
  end if;

  v_user_ok := (lower(v_clean_user) = lower(v_auth.username));
  v_pass_ok := public.dsb_verify_secret_hash(p_password, v_auth.password_hash);

  if not v_user_ok or not v_pass_ok then
    v_auth.failed_login_attempts := v_auth.failed_login_attempts + 1;
    if v_auth.failed_login_attempts >= v_max_attempts then
      update public.dsb_auth
      set failed_login_attempts = v_auth.failed_login_attempts,
          login_locked_until = now() + interval '15 minutes'
      where id = v_auth.id;

      return jsonb_build_object(
        'ok', false,
        'locked', true,
        'retryAfterSeconds', 900,
        'remainingAttempts', 0,
        'error', format('Alerta Anti-Hacking: acceso bloqueado por 15 minutos tras %s intentos fallidos.', v_max_attempts)
      );
    end if;

    update public.dsb_auth
    set failed_login_attempts = v_auth.failed_login_attempts
    where id = v_auth.id;

    v_remaining := greatest(0, v_max_attempts - v_auth.failed_login_attempts);
    return jsonb_build_object(
      'ok', false,
      'locked', false,
      'remainingAttempts', v_remaining,
      'error', format('Credenciales incorrectas. Te quedan %s intento(s) antes del bloqueo.', v_remaining)
    );
  end if;

  v_pre_token := encode(gen_random_bytes(24), 'hex');
  update public.dsb_auth
  set failed_login_attempts = 0,
      login_locked_until = null,
      pre_auth_token = v_pre_token,
      pre_auth_expires_at = now() + interval '10 minutes'
  where id = v_auth.id;

  return jsonb_build_object(
    'ok', true,
    'username', v_auth.username,
    'role', coalesce(v_auth.role, 'admin'),
    'preAuthToken', v_pre_token
  );
end;
$$;

create or replace function public.dsb_verify_pin(
  p_pin text,
  p_pre_auth_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth public.dsb_auth%rowtype;
  v_max_attempts constant int := 5;
  v_remaining int;
  v_retry_secs int;
  v_session text;
begin
  if p_pre_auth_token is not null and trim(p_pre_auth_token) <> '' then
    select * into v_auth from public.dsb_auth where pre_auth_token = p_pre_auth_token;
  else
    select * into v_auth from public.dsb_auth where id = 'default';
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Módulo de seguridad no inicializado.');
  end if;

  if v_auth.pin_locked_until is not null and v_auth.pin_locked_until > now() then
    v_retry_secs := greatest(1, ceil(extract(epoch from (v_auth.pin_locked_until - now())))::int);
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'retryAfterSeconds', v_retry_secs,
      'remainingAttempts', 0,
      'error', format('PIN bloqueado temporalmente por seguridad. Espera %s segundos.', v_retry_secs)
    );
  end if;

  if v_auth.pin_locked_until is not null and v_auth.pin_locked_until <= now() then
    update public.dsb_auth
    set failed_pin_attempts = 0, pin_locked_until = null
    where id = v_auth.id;
    v_auth.failed_pin_attempts := 0;
  end if;

  if v_auth.pre_auth_token is null
     or v_auth.pre_auth_expires_at is null
     or v_auth.pre_auth_expires_at <= now()
     or (p_pre_auth_token is not null and v_auth.pre_auth_token <> p_pre_auth_token) then
    return jsonb_build_object(
      'ok', false,
      'expiredFirstFactor', true,
      'error', 'Tu sesión del primer filtro expiró. Ingresa nuevamente tu usuario y contraseña.'
    );
  end if;

  if not public.dsb_verify_secret_hash(trim(coalesce(p_pin, '')), v_auth.pin_hash) then
    v_auth.failed_pin_attempts := v_auth.failed_pin_attempts + 1;
    if v_auth.failed_pin_attempts >= v_max_attempts then
      update public.dsb_auth
      set failed_pin_attempts = v_auth.failed_pin_attempts,
          pin_locked_until = now() + interval '15 minutes'
      where id = v_auth.id;

      return jsonb_build_object(
        'ok', false,
        'locked', true,
        'retryAfterSeconds', 900,
        'remainingAttempts', 0,
        'error', format('Alerta Anti-Hacking: PIN bloqueado por 15 minutos tras %s intentos fallidos.', v_max_attempts)
      );
    end if;

    update public.dsb_auth
    set failed_pin_attempts = v_auth.failed_pin_attempts
    where id = v_auth.id;

    v_remaining := greatest(0, v_max_attempts - v_auth.failed_pin_attempts);
    return jsonb_build_object(
      'ok', false,
      'locked', false,
      'remainingAttempts', v_remaining,
      'error', format('PIN incorrecto. Intentos restantes: %s.', v_remaining)
    );
  end if;

  v_session := encode(gen_random_bytes(32), 'hex');
  update public.dsb_auth
  set failed_pin_attempts = 0,
      pin_locked_until = null,
      pre_auth_token = null,
      pre_auth_expires_at = null,
      session_token = v_session,
      session_expires_at = now() + interval '8 hours'
  where id = v_auth.id;

  return jsonb_build_object(
    'ok', true,
    'sessionToken', v_session,
    'username', v_auth.username,
    'role', coalesce(v_auth.role, 'admin')
  );
end;
$$;

create or replace function public.dsb_verify_session(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth public.dsb_auth%rowtype;
begin
  if p_session_token is null or trim(p_session_token) = '' then
    return jsonb_build_object('authenticated', false);
  end if;

  select * into v_auth
  from public.dsb_auth
  where session_token = trim(p_session_token);

  if not found then
    return jsonb_build_object('authenticated', false);
  end if;

  if v_auth.session_token is not null
     and v_auth.session_expires_at is not null
     and v_auth.session_expires_at > now() then
    return jsonb_build_object(
      'authenticated', true,
      'username', v_auth.username,
      'role', coalesce(v_auth.role, 'admin')
    );
  end if;

  return jsonb_build_object('authenticated', false);
end;
$$;

create or replace function public.dsb_update_credentials(
  p_master_password text,
  p_new_username text default null,
  p_new_password text default null,
  p_new_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth public.dsb_auth%rowtype;
  v_max_attempts constant int := 5;
  v_remaining int;
  v_retry_secs int;
  v_next_username text;
  v_next_pass_hash text;
  v_next_pin_hash text;
  v_clean_user text := trim(coalesce(p_new_username, ''));
  v_clean_pin text := trim(coalesce(p_new_pin, ''));
begin
  select * into v_auth from public.dsb_auth where id = 'default';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Módulo de seguridad no inicializado.');
  end if;

  if v_auth.master_locked_until is not null and v_auth.master_locked_until > now() then
    v_retry_secs := greatest(1, ceil(extract(epoch from (v_auth.master_locked_until - now())))::int);
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'retryAfterSeconds', v_retry_secs,
      'error', format('Cambio de credenciales bloqueado temporalmente (%ss).', v_retry_secs)
    );
  end if;

  if v_auth.master_locked_until is not null and v_auth.master_locked_until <= now() then
    update public.dsb_auth
    set failed_master_attempts = 0, master_locked_until = null
    where id = 'default';
    v_auth.failed_master_attempts := 0;
  end if;

  if v_auth.master_hash <> crypt(coalesce(p_master_password, ''), v_auth.master_hash) then
    v_auth.failed_master_attempts := v_auth.failed_master_attempts + 1;
    if v_auth.failed_master_attempts >= v_max_attempts then
      update public.dsb_auth
      set failed_master_attempts = v_auth.failed_master_attempts,
          master_locked_until = now() + interval '15 minutes'
      where id = 'default';

      return jsonb_build_object(
        'ok', false,
        'locked', true,
        'retryAfterSeconds', 900,
        'remainingAttempts', 0,
        'error', 'Llave maestra inválida. Bloqueo preventivo activado por 15 minutos.'
      );
    end if;

    update public.dsb_auth
    set failed_master_attempts = v_auth.failed_master_attempts
    where id = 'default';

    v_remaining := greatest(0, v_max_attempts - v_auth.failed_master_attempts);
    return jsonb_build_object(
      'ok', false,
      'locked', false,
      'remainingAttempts', v_remaining,
      'error', format('Llave de autorización maestra inválida. Intentos restantes: %s.', v_remaining)
    );
  end if;

  v_next_username := v_auth.username;
  v_next_pass_hash := v_auth.password_hash;
  v_next_pin_hash := v_auth.pin_hash;

  if length(v_clean_user) > 0 then
    if length(v_clean_user) < 3 then
      return jsonb_build_object('ok', false, 'error', 'El usuario debe tener al menos 3 caracteres.');
    end if;
    v_next_username := v_clean_user;
  end if;

  if p_new_password is not null and length(p_new_password) > 0 then
    if length(p_new_password) < 6 then
      return jsonb_build_object('ok', false, 'error', 'La nueva contraseña debe tener al menos 6 caracteres.');
    end if;
    v_next_pass_hash := crypt(p_new_password, gen_salt('bf', 10));
  end if;

  if length(v_clean_pin) > 0 then
    if v_clean_pin !~ '^\d{4,12}$' then
      return jsonb_build_object('ok', false, 'error', 'El nuevo PIN debe contener entre 4 y 12 dígitos numéricos.');
    end if;
    v_next_pin_hash := crypt(v_clean_pin, gen_salt('bf', 10));
  end if;

  update public.dsb_auth
  set username = v_next_username,
      password_hash = v_next_pass_hash,
      pin_hash = v_next_pin_hash,
      failed_master_attempts = 0,
      master_locked_until = null,
      updated_at = now()
  where id = 'default';

  return jsonb_build_object(
    'ok', true,
    'username', v_next_username,
    'message', 'Credenciales de seguridad actualizadas correctamente.'
  );
end;
$$;

revoke execute on function public.dsb_login_step1(text, text) from anon, authenticated, public;
revoke execute on function public.dsb_verify_pin(text, text) from anon, authenticated, public;
revoke execute on function public.dsb_verify_session(text) from anon, authenticated, public;
revoke execute on function public.dsb_update_credentials(text, text, text, text) from anon, authenticated, public;

grant execute on function public.dsb_login_step1(text, text) to service_role;
grant execute on function public.dsb_verify_pin(text, text) to service_role;
grant execute on function public.dsb_verify_session(text) to service_role;
grant execute on function public.dsb_update_credentials(text, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 7. Datos semilla iniciales (idempotentes)
-- ----------------------------------------------------------------------------
insert into public.app_settings (
  id,
  advisor_name,
  host_title,
  brand_subtitle,
  default_ticket_amount,
  require_pin,
  pin_code,
  gift_theme,
  custom_box_color,
  showcase_style,
  randomize_gifts
)
values (
  'default',
  'Jose Miguel Ciprian',
  'The Ciprian Company',
  'The Ciprian Company · Show de Cocina',
  2792,
  false,
  '',
  'autumn',
  '#C88A2B',
  'luminous-gold',
  true
)
on conflict (id) do nothing;

delete from public.gifts
where id in ('gift-cutlery', 'gift-bowls', 'gift-sandokan', 'gift-warner', 'gift-bamboo');

insert into public.gifts (
  id,
  name,
  subtitle,
  usage_tip,
  tag,
  visual_key,
  custom_image_url,
  accent_color,
  active,
  stock_label,
  probability,
  sort_order
)
values
  (
    'gift-utensils-6',
    'Juego de Utensilios de 6 Piezas',
    'Set de 6 utensilios profesionales Royal Prestige en acero inoxidable de grado quirúrgico.',
    'Úsalos para voltear, servir pastas, guisos y caldos sin rayar ni dañar tus ollas o sartenes.',
    'Colección Acero · $300 USD',
    'cutlery',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_ccc0c9bc-Photoroom.png',
    '#C88A2B',
    true,
    'Edición Exclusiva',
    30,
    1
  ),
  (
    'gift-utensil-holder',
    'Recipiente para Utensilios',
    'Cilindro organizador Royal Prestige en acero inoxidable cepillado con base firme (MISC SP0145).',
    'Mantén tus espátulas y cucharones favoritos secos, ordenados y siempre a la mano junto a la estufa.',
    'Organización · $99 USD',
    'pot',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_b86f199c-Photoroom.png',
    '#8C6E58',
    true,
    'Disponible',
    30,
    2
  ),
  (
    'gift-bowls-3',
    'Juego de 3 Tazones para Mezclar',
    'Set de 3 tazones herméticos en acero inoxidable con base antideslizante y tapas selladoras (PREM PR4902).',
    'Prepara masas, marina carnes y conserva ensaladas frescas por más días gracias a su sello hermético.',
    'Favorito del Chef · $500 USD',
    'bowls',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.48_17872483-Photoroom.png',
    '#B84A27',
    true,
    'Alta Demanda',
    30,
    3
  ),
  (
    'gift-santoku-5',
    'Cuchillo Santoku 5"',
    'Cuchillo de precisión alveolado de 5 pulgadas con acero forjado Royal Prestige (MISC SP0296).',
    'Sus alvéolos evitan que el alimento se pegue al rebanar verduras finas, quesos o filetes con corte limpio.',
    'Corte Maestro · $550 USD',
    'knife',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.49_a69260c7-Photoroom.png',
    '#8C3B20',
    true,
    'Edición Limitada',
    5,
    4
  ),
  (
    'gift-cleaver-7',
    'Hacha de Cocina de 7"',
    'Hacha profesional de 7 pulgadas en acero balanceado de alto desempeño Royal Prestige (MRCH CU0825).',
    'Aprovecha su hoja ancha para trozar carnes con firmeza y trasladar ingredientes picados de la tabla a la olla.',
    'Precision Cut · $450 USD',
    'knife',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.49_4eb72c8b-Photoroom.png',
    '#5B4636',
    true,
    'Disponible',
    3,
    5
  ),
  (
    'gift-icecream-2',
    'Juego de 2 Copas para Helado',
    'Dúo de copas térmicas de acero pulido espejo diseñadas para postres y sorbetes (MISC SP0252).',
    'Enfría las copas 5 minutos antes de servir para mantener helados, mousses o frutas fríos por más tiempo.',
    'Mesa Gourmet · $199 USD',
    'bowls',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.49_0f9b4d38-Photoroom.png',
    '#C88A2B',
    true,
    'Disponible',
    30,
    6
  ),
  (
    'gift-mugs-2',
    'Juego de 2 Tazas con Pared Doble',
    'Par de tazas térmicas de doble pared en acero inoxidable Royal Prestige (MISC SP0136).',
    'Disfruta café, té o chocolate a temperatura ideal sin quemarte las manos ni generar condensación.',
    'Experiencia Térmica · $200 USD',
    'kettle',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.50_c2f45d1c-Photoroom.png',
    '#7C4327',
    true,
    'Disponible',
    30,
    7
  ),
  (
    'gift-bamboo-large',
    'Tabla de Bambú Grande',
    'Tabla de corte artesanal en bambú orgánico prensado con canal colector de jugos (PREM PR0008).',
    'Corta con seguridad cuidando el filo de tus cuchillos y usa su canal lateral para recoger jugos al asar carnes.',
    'Madera Noble · $300 USD',
    'bamboo',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.50_ba6c52cc-Photoroom.png',
    '#A66328',
    true,
    'Disponible',
    5,
    8
  ),
  (
    'gift-warmer-pro',
    'Royal Prestige Warmer Pro',
    'Contenedor térmico eléctrico portátil para conservar tortillas y platillos calientes (PREM PE4000).',
    'Mantén tus tortillas suaves y comidas calientes en la mesa o en reuniones gracias a su batería recargable portátil.',
    'Edición Estrella · $600 USD',
    'thermo',
    '/sin%20fondo/WhatsApp_Image_2026-11-17_at_7.45.50_621e0247-Photoroom.png',
    '#4B644A',
    true,
    'Edición Estrella',
    10,
    9
  )
on conflict (id) do update set
  name = excluded.name,
  subtitle = excluded.subtitle,
  usage_tip = excluded.usage_tip,
  tag = excluded.tag,
  visual_key = excluded.visual_key,
  custom_image_url = excluded.custom_image_url,
  accent_color = excluded.accent_color,
  active = excluded.active,
  stock_label = excluded.stock_label,
  probability = excluded.probability,
  sort_order = excluded.sort_order;

insert into public.dsb_auth (
  id,
  username,
  role,
  password_hash,
  pin_hash,
  master_hash
)
values (
  'default',
  'AdminCiprian',
  'admin',
  '$2a$10$4uVKRgYY9yuM1KgBWCsAEuADvJEoaLNZwbjb0vCOih5MqnTCEdh.G',
  '$2a$10$Ht.aqXlB7b3GzsEpA5x6zuv7c/QE8vF1rDd2cn48lZeEk/os2bZ3y',
  '$2a$10$p0RyMN7tmRgzKJoZRKjAY./8t6TFXwXcZ2riAbOAR0DbgPTH4IgX2'
),
(
  'caller',
  'Caller',
  'caller',
  'sha256$caller_pwd_s1$619d4db488230618b7cae0edb9032dbaa4e5817d3b1cc1cf079a76f07c5f3295',
  'sha256$caller_pin_s1$a0fd4eb49c0feef1123ea3d135bc07021a688893377d9c79d7eefa5cd8b427c3',
  '$2a$10$p0RyMN7tmRgzKJoZRKjAY./8t6TFXwXcZ2riAbOAR0DbgPTH4IgX2'
)
on conflict (id) do update set
  username = excluded.username,
  role = excluded.role,
  password_hash = excluded.password_hash,
  pin_hash = excluded.pin_hash;
