-- CostTrack Database Schema
-- Run this in the Supabase SQL editor

-- profiles: extended user data tied to Supabase auth
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  role text check (role in ('EDITOR', 'VIEWER')) not null default 'VIEWER',
  created_at timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- jobs: one row per uploaded project
create table jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  job_number text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now(),
  status text default 'active'
);

-- phases: one row per Excel tab or whole job
create table phases (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  phase_name text not null,
  phase_code text,
  is_single_phase boolean default false,
  sort_order int default 0
);

-- cost_code_lines: core data table
create table cost_code_lines (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid references phases(id) on delete cascade,
  cost_code text not null,
  description text,
  type text check (type in ('LABOR', 'MATERIALS')) not null,
  budget_amount numeric(14,4) default 0,
  committed_cost_foundation numeric(14,4),
  committed_cost_override numeric(14,4),
  pct_complete_override numeric(5,2),
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- sync_log: Foundation sync audit trail
create table sync_log (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  synced_at timestamptz default now(),
  synced_by uuid references profiles(id),
  rows_updated int,
  errors text
);

-- overrides_audit: every manual override change
create table overrides_audit (
  id uuid primary key default gen_random_uuid(),
  cost_code_line_id uuid references cost_code_lines(id) on delete cascade,
  changed_by uuid references profiles(id),
  changed_at timestamptz default now(),
  field_name text,
  old_value text,
  new_value text
);

-- Row-level security: enable but allow service role full access
alter table profiles enable row level security;
alter table jobs enable row level security;
alter table phases enable row level security;
alter table cost_code_lines enable row level security;
alter table sync_log enable row level security;
alter table overrides_audit enable row level security;

-- Authenticated users can read everything (API enforces finer RBAC)
create policy "Authenticated read all" on jobs for select using (auth.role() = 'authenticated');
create policy "Authenticated read all" on phases for select using (auth.role() = 'authenticated');
create policy "Authenticated read all" on cost_code_lines for select using (auth.role() = 'authenticated');
create policy "Authenticated read all" on sync_log for select using (auth.role() = 'authenticated');
create policy "Authenticated read all" on overrides_audit for select using (auth.role() = 'authenticated');
create policy "Authenticated read own profile" on profiles for select using (auth.uid() = id);
