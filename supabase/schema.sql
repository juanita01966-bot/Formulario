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
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Catálogo de obsequios exclusivos
-- ----------------------------------------------------------------------------
create table if not exists public.gifts (
  id text primary key,
  name text not null,
  subtitle text not null default '',
  tag text not null default '',
  visual_key text not null default 'cutlery',
  custom_image_url text,
  accent_color text not null default '#C88A2B',
  active boolean not null default true,
  stock_label text not null default 'Disponible',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Bóveda de autenticación 2FA del DSB (acceso exclusivo vía RPC SECURITY DEFINER)
-- ----------------------------------------------------------------------------
create table if not exists public.dsb_auth (
  id text primary key default 'default',
  username text not null,
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

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.gifts enable row level security;
alter table public.leads enable row level security;
alter table public.dsb_auth enable row level security;

-- Revocar acceso directo desde cliente a la tabla de credenciales/hashes
revoke all on table public.dsb_auth from anon, authenticated, public;

drop policy if exists "app_settings_public_access" on public.app_settings;
create policy "app_settings_public_access"
  on public.app_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "gifts_public_access" on public.gifts;
create policy "gifts_public_access"
  on public.gifts
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "leads_public_access" on public.leads;
create policy "leads_public_access"
  on public.leads
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_settings, public.gifts, public.leads to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Funciones RPC de seguridad (2FA: Usuario/Clave + PIN Caja Fuerte + Llave Maestra)
-- ----------------------------------------------------------------------------
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
  select * into v_auth from public.dsb_auth where id = 'default';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Módulo de seguridad no inicializado.');
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
    where id = 'default';
    v_auth.failed_login_attempts := 0;
  end if;

  v_user_ok := (v_clean_user = v_auth.username)
    or (v_auth.username = 'AdminCripian' and lower(v_clean_user) = 'admincripian');
  v_pass_ok := (v_auth.password_hash = crypt(coalesce(p_password, ''), v_auth.password_hash));

  if not v_user_ok or not v_pass_ok then
    v_auth.failed_login_attempts := v_auth.failed_login_attempts + 1;
    if v_auth.failed_login_attempts >= v_max_attempts then
      update public.dsb_auth
      set failed_login_attempts = v_auth.failed_login_attempts,
          login_locked_until = now() + interval '15 minutes'
      where id = 'default';

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
    where id = 'default';

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
  where id = 'default';

  return jsonb_build_object(
    'ok', true,
    'username', v_auth.username,
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
  select * into v_auth from public.dsb_auth where id = 'default';
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
    where id = 'default';
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

  if v_auth.pin_hash <> crypt(trim(coalesce(p_pin, '')), v_auth.pin_hash) then
    v_auth.failed_pin_attempts := v_auth.failed_pin_attempts + 1;
    if v_auth.failed_pin_attempts >= v_max_attempts then
      update public.dsb_auth
      set failed_pin_attempts = v_auth.failed_pin_attempts,
          pin_locked_until = now() + interval '15 minutes'
      where id = 'default';

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
    where id = 'default';

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
  where id = 'default';

  return jsonb_build_object(
    'ok', true,
    'sessionToken', v_session,
    'username', v_auth.username
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
  select * into v_auth from public.dsb_auth where id = 'default';
  if not found then
    return jsonb_build_object('authenticated', false);
  end if;

  if v_auth.session_token is not null
     and v_auth.session_expires_at is not null
     and v_auth.session_expires_at > now()
     and trim(coalesce(p_session_token, '')) = v_auth.session_token then
    return jsonb_build_object('authenticated', true, 'username', v_auth.username);
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

grant execute on function public.dsb_login_step1(text, text) to anon, authenticated;
grant execute on function public.dsb_verify_pin(text, text) to anon, authenticated;
grant execute on function public.dsb_verify_session(text) to anon, authenticated;
grant execute on function public.dsb_update_credentials(text, text, text, text) to anon, authenticated;

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
  custom_box_color
)
values (
  'default',
  'Jose Miguel Ciprian',
  'The Ciprian Company',
  'The Ciprian Company · Show de Cocina',
  2792,
  false,
  '2026',
  'autumn',
  '#C88A2B'
)
on conflict (id) do nothing;

insert into public.gifts (
  id,
  name,
  subtitle,
  tag,
  visual_key,
  accent_color,
  active,
  stock_label,
  sort_order
)
values
  (
    'gift-cutlery',
    'Cubiertos Acero Inox',
    'Juego de cubiertos en acero inoxidable de grado quirúrgico con acabado espejo.',
    'Colección Mesa de Otoño',
    'cutlery',
    '#C88A2B',
    true,
    'Edición Limitada',
    1
  ),
  (
    'gift-bowls',
    'Set 2 Tazones',
    'Set de 2 tazones térmicos de acero inoxidable con base antideslizante y sello hermético.',
    'Favorito del Chef',
    'bowls',
    '#B84A27',
    true,
    'Disponible',
    2
  ),
  (
    'gift-sandokan',
    'Cuchillo Sandokan',
    'Cuchillo de chef especializado Sandokan con filo alveolado de alta precisión.',
    'Corte Maestro',
    'knife',
    '#8C3B20',
    true,
    'Alta Demanda',
    3
  ),
  (
    'gift-warner',
    'Contenedor Térmico Warner Pro',
    'Contenedor térmico profesional de doble pared para conservar alimentos calientes o fríos.',
    'Especial Cosecha',
    'thermo',
    '#4B644A',
    true,
    'Disponible',
    4
  ),
  (
    'gift-bamboo',
    'Tabla Bambú',
    'Tabla de corte artesanal en bambú orgánico prensado con canal colector de jugos.',
    'Madera Noble',
    'bamboo',
    '#A66328',
    true,
    'Disponible',
    5
  )
on conflict (id) do nothing;

insert into public.dsb_auth (
  id,
  username,
  password_hash,
  pin_hash,
  master_hash
)
values (
  'default',
  'AdminCripian',
  crypt('AdminMaster2026@', gen_salt('bf', 10)),
  crypt('1966', gen_salt('bf', 10)),
  crypt('PoloNorte121966@', gen_salt('bf', 10))
)
on conflict (id) do nothing;
