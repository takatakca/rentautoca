-- Allow users to delete their own profile (GDPR right to erasure)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- Stripe webhook events: only service role (which bypasses RLS) may insert.
-- Explicit restrictive policy denies any client-side inserts.
CREATE POLICY "Block client inserts on webhook events"
ON public.stripe_webhook_events
FOR INSERT
WITH CHECK (false);