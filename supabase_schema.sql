-- 1. Tabel Rekening Kas (cash_accounts)
CREATE TABLE cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Tabel Pos Anggaran (budget_pos)
CREATE TABLE budget_pos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year date NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  name text NOT NULL,
  budget_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Tabel Sub-Akun Anggaran (budget_sub_items)
CREATE TABLE budget_sub_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_pos_id uuid REFERENCES budget_pos(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Aktifkan RLS 
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_sub_items ENABLE ROW LEVEL SECURITY;

-- === POLICIES UNTUK cash_accounts ===
CREATE POLICY "Users can view their own cash accounts" ON cash_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cash accounts" ON cash_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cash accounts" ON cash_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cash accounts" ON cash_accounts
  FOR DELETE USING (auth.uid() = user_id);


-- === POLICIES UNTUK budget_pos ===
CREATE POLICY "Users can view their own budget pos" ON budget_pos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget pos" ON budget_pos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget pos" ON budget_pos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget pos" ON budget_pos
  FOR DELETE USING (auth.uid() = user_id);


-- === POLICIES UNTUK budget_sub_items ===
-- Karena tabel ini tidak punya user_id, referensi policy dicek via budget_pos_id
CREATE POLICY "Users can view their own budget sub items" ON budget_sub_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM budget_pos 
      WHERE budget_pos.id = budget_sub_items.budget_pos_id AND budget_pos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own budget sub items" ON budget_sub_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM budget_pos 
      WHERE budget_pos.id = budget_sub_items.budget_pos_id AND budget_pos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own budget sub items" ON budget_sub_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM budget_pos 
      WHERE budget_pos.id = budget_sub_items.budget_pos_id AND budget_pos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own budget sub items" ON budget_sub_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM budget_pos 
      WHERE budget_pos.id = budget_sub_items.budget_pos_id AND budget_pos.user_id = auth.uid()
    )
  );
