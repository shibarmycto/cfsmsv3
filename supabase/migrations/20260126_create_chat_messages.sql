-- Create chat_messages table for global and private chat
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  message text not null,
  type text not null default 'global', -- 'global' or 'private'
  recipient_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.chat_messages enable row level security;

-- RLS policies
create policy "Anyone can read chat messages"
  on public.chat_messages for select
  using (true);

create policy "Users can insert their own messages"
  on public.chat_messages for insert
  with check (auth.uid() = player_id);

-- Create index for performance
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at desc);
create index if not exists idx_chat_messages_type on public.chat_messages(type);
