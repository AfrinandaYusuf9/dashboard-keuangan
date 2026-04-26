-- ============================================
-- PLANNING ENTRIES TABLE
-- Untuk fitur Rencana Keuangan (Proyeksi)
-- Terisolasi dari tabel transaksi/saldo lainnya
-- ============================================

CREATE TABLE IF NOT EXISTS planning_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,            -- Format: 'YYYY-MM', misal '2026-05'
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,         -- Nama bebas: 'Gaji', 'THR', 'Liburan', dll
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE planning_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own planning entries"
  ON planning_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planning entries"
  ON planning_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planning entries"
  ON planning_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planning entries"
  ON planning_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Index untuk performa query per user dan bulan
CREATE INDEX idx_planning_entries_user_month ON planning_entries (user_id, month);
