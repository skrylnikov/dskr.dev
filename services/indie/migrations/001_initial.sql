create table if not exists notes (
  id uuid primary key,
  kind text not null check (kind in ('note', 'reply', 'like')),
  content text not null default '',
  target_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists notes_created_at_idx on notes (created_at desc);

create table if not exists webmentions (
  id bigserial primary key,
  source_url text not null,
  target_url text not null,
  property text not null check (property in ('mention-of', 'in-reply-to', 'like-of')),
  status text not null check (status in ('pending', 'verified', 'rejected', 'deleted')),
  author_name text,
  author_url text,
  author_photo text,
  source_name text,
  content_text text,
  published_at timestamptz,
  received_at timestamptz not null,
  verified_at timestamptz,
  unique (source_url, target_url)
);

create index if not exists webmentions_target_idx on webmentions (target_url, status, received_at desc);

create table if not exists deliveries (
  id bigserial primary key,
  note_id uuid not null references notes(id) on delete cascade,
  target_url text not null,
  endpoint_url text,
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null,
  last_response integer,
  last_error text,
  unique (note_id, target_url)
);

create table if not exists auth_codes (
  code_hash text primary key,
  client_id text not null,
  redirect_uri text not null,
  scope text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists access_tokens (
  token_hash text primary key,
  client_id text not null,
  scope text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists sessions (
  session_hash text primary key,
  expires_at timestamptz not null
);
