-- Schema definition for the CARGO Rewards portal when hosted on
-- Supabase. This file defines all tables along with basic row level
-- security policies to ensure that users only have access to their own
-- data. Execute these statements in the Supabase SQL editor or via
-- the supabase CLI after creating a new project.

-- Users table extends the built‑in auth.users table by storing
-- additional profile fields. We reference the auth.users.id (a UUID)
-- as our primary key. When a user is deleted from auth.users their
-- corresponding profile row will be removed via ON DELETE CASCADE.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  companyname text,
  name text,
  role text check (role in ('ADMIN','MANAGER','STAFF','CUSTOMER')),
  status text default 'ACTIVE',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Customers table stores KYC/registration details for companies. If the
-- portal later separates customers and users, the user_id column can
-- be removed or set nullable.
create table if not exists public.customers (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  company_name text,
  tax_id text,
  businessfield text,
  pic_name text,
  phone text,
  email text,
  address text,
  salesname text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Program configuration table stores JSON objects defining business
-- rules such as discount tiers. Only administrators should be able
-- to modify these values.
create table if not exists public.program_configs (
  id bigint generated always as identity primary key,
  key text not null unique,
  value jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Transactions table stores shipment transactions. The user_id column
-- associates each transaction to the auth user who created it.
create table if not exists public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  date date not null,
  service text not null,
  origin text not null,
  destination text not null,
  publish_rate numeric(15,2) not null,
  discount_amount numeric(15,2),
  cashback_amount numeric(15,2),
  points_earned integer,
  invoice_no text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Reward ledger captures all point, credit, cashback and adjustment
-- mutations. Use type to differentiate entries. ref_id can be used
-- to link to a transaction or redemption record.
create table if not exists public.reward_ledgers (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  type text check (type in ('POINT','CREDIT','CASHBACK','ADJUST')),
  amount numeric(15,2),
  points integer,
  ref_id bigint,
  note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Redemption requests table. When a user requests to redeem their
-- points the status is initially set to PENDING. A manager can later
-- approve or reject the request.
create table if not exists public.redemptions (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  kind text check (kind in ('CREDIT','CASH_OUT')),
  amount numeric(15,2) not null,
  points_used integer not null,
  status text check (status in ('PENDING','APPROVED','REJECTED','PAID')) default 'PENDING',
  approved_by uuid references public.users(id),
  approved_at timestamp with time zone,
  meta jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Quarterly tier snapshots for users. Use this table to record
-- multipliers and total points per quarter to simplify reporting.
create table if not exists public.tier_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  tier text,
  quarter_start date,
  quarter_end date,
  multiplier numeric(5,2),
  points_quarter integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Audit log table to record important actions for auditing purposes.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id),
  action text,
  entity_type text,
  entity_id bigint,
  payload jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Feature flag table to toggle functionality at runtime.
create table if not exists public.feature_flags (
  id bigint generated always as identity primary key,
  key text unique not null,
  enabled boolean default false,
  value jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS) on tables and define basic policies.
-- These policies restrict data so that users can only read and write
-- rows associated with their own user_id. Administrators can later
-- extend these policies to grant broader access.

alter table public.users enable row level security;
create policy if not exists "Users can view their profile" on public.users
  for select using ( id = auth.uid() );

alter table public.transactions enable row level security;
create policy if not exists "Users can view their transactions" on public.transactions
  for select using ( user_id = auth.uid() );
create policy if not exists "Users can insert their transactions" on public.transactions
  for insert with check ( user_id = auth.uid() );

alter table public.reward_ledgers enable row level security;
create policy if not exists "Users can view their ledger" on public.reward_ledgers
  for select using ( user_id = auth.uid() );
create policy if not exists "Users can insert ledger entries" on public.reward_ledgers
  for insert with check ( user_id = auth.uid() );

alter table public.redemptions enable row level security;
create policy if not exists "Users can view their redemptions" on public.redemptions
  for select using ( user_id = auth.uid() );
create policy if not exists "Users can create redemptions" on public.redemptions
  for insert with check ( user_id = auth.uid() );

-- Program configs are restricted to administrators only. By default
-- all access is denied. Managers should not see program configuration
-- values. Additional policies can be added to allow selected roles.
alter table public.program_configs enable row level security;
create policy if not exists "No one can access program configs" on public.program_configs
  as permissive for all using ( false );