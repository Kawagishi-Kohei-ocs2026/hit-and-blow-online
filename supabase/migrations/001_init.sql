-- ゲームルームテーブル
create table if not exists rooms (
  id text primary key,                        -- ルームID (nanoid 6文字)
  answer text[] not null,                     -- 正解の色配列 (4要素)
  status text not null default 'waiting',     -- waiting | playing | finished
  current_player int not null default 1,      -- 1 or 2
  winner int,                                 -- 1, 2, or null (引き分け)
  player1_id text,                            -- ゲストID
  player2_id text,
  created_at timestamptz default now()
);

-- 推測履歴テーブル
create table if not exists guesses (
  id bigserial primary key,
  room_id text references rooms(id) on delete cascade,
  player int not null,                        -- 1 or 2
  turn int not null,                          -- 1〜4
  colors text[] not null,                     -- 推測した色配列
  hit int not null,
  blow int not null,
  created_at timestamptz default now()
);

-- Realtime有効化
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table guesses;

-- RLS (Row Level Security) - 全員読み書き可（匿名ゲスト用）
alter table rooms enable row level security;
alter table guesses enable row level security;

create policy "allow all rooms" on rooms for all using (true) with check (true);
create policy "allow all guesses" on guesses for all using (true) with check (true);
