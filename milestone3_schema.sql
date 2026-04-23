-- 1. Tabel Transaksi Harian (transactions)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_account_id uuid REFERENCES cash_accounts(id) ON DELETE CASCADE,
  budget_sub_item_id uuid REFERENCES budget_sub_items(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('in', 'out')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Aktifkan RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- === POLICIES UNTUK transactions ===
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);


-- 2. Logika Trigger Otomatis Pembaruan Saldo

-- Membuat Fungsi Database (RPC / Function) 
CREATE OR REPLACE FUNCTION update_cash_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Logika saat INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'in' THEN
      UPDATE cash_accounts SET balance = balance + NEW.amount WHERE id = NEW.cash_account_id;
    ELSIF NEW.type = 'out' THEN
      UPDATE cash_accounts SET balance = balance - NEW.amount WHERE id = NEW.cash_account_id;
    END IF;
  
  -- (Opsional tapi direkomendasikan): Logika saat UPDATE transaksi jika pengguna memodifikasi nominal/tipe
  -- Kasus ini mengembalikan saldo awal sebelum diubah, lalu menerapkan saldo terbaru.
  ELSIF TG_OP = 'UPDATE' THEN
    -- Kembalikan yang lama dulu (rollback efek saldo transaksi lama)
    IF OLD.type = 'in' THEN
      UPDATE cash_accounts SET balance = balance - OLD.amount WHERE id = OLD.cash_account_id;
    ELSIF OLD.type = 'out' THEN
      UPDATE cash_accounts SET balance = balance + OLD.amount WHERE id = OLD.cash_account_id;
    END IF;
    
    -- Terapkan yang baru
    IF NEW.type = 'in' THEN
      UPDATE cash_accounts SET balance = balance + NEW.amount WHERE id = NEW.cash_account_id;
    ELSIF NEW.type = 'out' THEN
      UPDATE cash_accounts SET balance = balance - NEW.amount WHERE id = NEW.cash_account_id;
    END IF;

  -- (Opsional direkomendasikan): Logika saat DELETE transaksi
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'in' THEN
      UPDATE cash_accounts SET balance = balance - OLD.amount WHERE id = OLD.cash_account_id;
    ELSIF OLD.type = 'out' THEN
      UPDATE cash_accounts SET balance = balance + OLD.amount WHERE id = OLD.cash_account_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Menghapus trigger lama (bertahan aman jika dipanggil dobel scriptnya)
DROP TRIGGER IF EXISTS on_transaction_insert_update_delete ON transactions;

-- Mengaitkan fungsi ke tabel `transactions` sebagai trigger
CREATE TRIGGER on_transaction_insert_update_delete
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_cash_account_balance();
