-- Beatforge schema + RLS. Run in Supabase SQL editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists beats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  data jsonb not null,
  is_public boolean not null default false,
  remix_of uuid references beats(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists beats_public_idx on beats (is_public, created_at desc);
create index if not exists beats_user_idx on beats (user_id, created_at desc);

create table if not exists likes (
  beat_id uuid references beats(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (beat_id, user_id)
);

-- Auto-create a profile row when a user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- View exposing like counts for sorting.
create or replace view beats_with_likes as
  select b.*, coalesce(l.cnt, 0) as like_count
  from beats b
  left join (select beat_id, count(*) cnt from likes group by beat_id) l
    on l.beat_id = b.id;

-- RLS
alter table profiles enable row level security;
alter table beats enable row level security;
alter table likes enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "profiles update own" on profiles for update using (auth.uid() = id);

create policy "beats read public or own" on beats for select
  using (is_public or auth.uid() = user_id);
create policy "beats insert own" on beats for insert
  with check (auth.uid() = user_id);
create policy "beats update own" on beats for update using (auth.uid() = user_id);
create policy "beats delete own" on beats for delete using (auth.uid() = user_id);

create policy "likes readable" on likes for select using (true);
create policy "likes insert own" on likes for insert with check (auth.uid() = user_id);
create policy "likes delete own" on likes for delete using (auth.uid() = user_id);
