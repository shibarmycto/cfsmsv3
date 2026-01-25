-- Enable realtime for token-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_news;