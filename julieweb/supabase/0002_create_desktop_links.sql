create table if not exists public.desktop_links (
    code text primary key,
    user_id uuid references auth.users (id) on delete cascade,
    payload jsonb not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.desktop_links enable row level security;
