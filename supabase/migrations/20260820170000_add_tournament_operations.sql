-- WAB-TKD Tournament Operations extension.
-- Additive only: does not alter V35 judging/scoring tables.
create table if not exists public.tournament_mat_weight_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid,
  mat_number integer not null,
  weight_category text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(tournament_id, mat_number, weight_category)
);
create index if not exists idx_tournament_mat_weight_rules_tournament on public.tournament_mat_weight_rules(tournament_id);
create table if not exists public.tournament_operation_locks (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid,
  lock_type text not null,
  reason text,
  locked_by text,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists idx_tournament_operation_locks_tournament on public.tournament_operation_locks(tournament_id);
