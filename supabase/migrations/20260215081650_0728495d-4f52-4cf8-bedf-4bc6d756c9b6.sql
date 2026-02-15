-- Add missing columns for trade tracking
ALTER TABLE public.signal_trades
  ADD COLUMN IF NOT EXISTS token_name text DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS token_symbol text DEFAULT 'UNK',
  ADD COLUMN IF NOT EXISTS entry_sol numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pnl_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exit_reason text,
  ADD COLUMN IF NOT EXISTS exit_signature text,
  ADD COLUMN IF NOT EXISTS gross_profit_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_profit_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Add index for quick user lookups
CREATE INDEX IF NOT EXISTS idx_signal_trades_user_status ON signal_trades(user_id, status);