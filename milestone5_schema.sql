-- Tabel Aset Investasi (assets)
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  acquisition_cost numeric NOT NULL DEFAULT 0, -- Harga Perolehan per Unit
  current_price_per_unit numeric NOT NULL DEFAULT 0, -- Harga Saat Ini per Unit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mengaktifkan RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- === POLICIES UNTUK assets ===
CREATE POLICY "Users can view their own assets" ON assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets" ON assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" ON assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" ON assets
  FOR DELETE USING (auth.uid() = user_id);
