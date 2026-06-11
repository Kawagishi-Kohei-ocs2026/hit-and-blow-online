# 🎯 ヒット＆ブロー オンライン

リアルタイム2人対戦のヒット＆ブローゲームです。  
Supabase (DB + Realtime) + Vite + Vercel で動作します。

---

## セットアップ手順

### 1. Supabase プロジェクトを作成

1. [supabase.com](https://supabase.com) でプロジェクトを新規作成
2. **SQL Editor** を開き、`supabase/migrations/001_init.sql` の内容を貼り付けて実行
3. **Project Settings → API** から以下をメモ：
   - `Project URL`
   - `anon public` キー

### 2. ローカル開発

```bash
# 依存関係インストール
npm install

# 環境変数ファイルを作成
cp .env.example .env
# .env を編集して Supabase の値を入力

# 開発サーバー起動
npm run dev
```

### 3. GitHub にプッシュ

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_NAME/hit-and-blow-online.git
git push -u origin main
```

### 4. Vercel にデプロイ

1. [vercel.com](https://vercel.com) でリポジトリをインポート
2. **Environment Variables** に以下を追加：
   ```
   VITE_SUPABASE_URL=https://ktldrrwacbbzyjlvnilt.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bGRycndhY2JienlqbHZuaWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTYzMzgsImV4cCI6MjA5NjY5MjMzOH0.Q3_MS_PW30yupo0uT6dI3KlA3V1o2aX8IiK7fe_NW4E
   ```
3. **Build Command**: `npm run build`  
   **Output Directory**: `dist`  
   → そのままでOK（vite.config.js で設定済み）
4. デプロイ完了！

---

## ゲームの遊び方

1. 「ルームを作成する」でルームを作成
2. 表示されたURLを友達に共有
3. 友達がURLを開くとゲーム開始
4. 交互に色を4つ選んで「判定する」
5. ヒット（色と場所が正解）＆ブロー（色のみ正解）のヒントをもとに正解を当てよう

---

## 技術スタック

- **フロントエンド**: Vanilla JS + Vite
- **リアルタイム通信**: Supabase Realtime (Postgres Changes)
- **データベース**: Supabase (PostgreSQL)
- **ホスティング**: Vercel
