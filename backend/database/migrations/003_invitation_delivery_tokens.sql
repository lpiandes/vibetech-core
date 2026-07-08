CREATE TABLE IF NOT EXISTS invitation_delivery_tokens (
  invitation_id UUID PRIMARY KEY REFERENCES invitations(id) ON DELETE CASCADE,
  token_ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
