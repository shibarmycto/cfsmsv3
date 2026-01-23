-- Allow users to delete their own sender ID requests
CREATE POLICY "Users can delete own sender requests"
ON public.sender_id_requests
FOR DELETE
USING (auth.uid() = user_id);