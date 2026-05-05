import { getSupabaseService } from '../../infrastructure/db/supabase.js';

export interface VerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface RefreshSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Token repository — manages verification and password reset tokens.
 */
export class TokenRepository {
  /**
   * Create a new email verification token.
   */
  async createVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<VerificationToken> {
    const supabase = getSupabaseService();
    await this.revokeActiveVerificationTokens(userId);
    const { data, error } = await supabase
      .from('email_verification_tokens')
      .insert([{ user_id: userId, token, expires_at: expiresAt.toISOString() }] as never[])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find a verification token by token string.
   */
  async findVerificationToken(token: string): Promise<VerificationToken | null> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Mark a verification token as used.
   */
  async markVerificationTokenUsed(tokenId: string): Promise<void> {
    const supabase = getSupabaseService();
    const { error } = await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() } as never)
      .eq('id', tokenId);

    if (error) throw error;
  }

  /**
   * Create a new password reset token.
   */
  async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<PasswordResetToken> {
    const supabase = getSupabaseService();
    await this.revokeActivePasswordResetTokens(userId);
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .insert([{ user_id: userId, token, expires_at: expiresAt.toISOString() }] as never[])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find a password reset token by token string.
   */
  async findPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Mark a password reset token as used.
   */
  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    const supabase = getSupabaseService();
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() } as never)
      .eq('id', tokenId);

    if (error) throw error;
  }

  async revokeActiveVerificationTokens(userId: string): Promise<void> {
    const supabase = getSupabaseService();
    const { error } = await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() } as never)
      .eq('user_id', userId)
      .is('used_at', null);

    if (error) throw error;
  }

  async revokeActivePasswordResetTokens(userId: string): Promise<void> {
    const supabase = getSupabaseService();
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() } as never)
      .eq('user_id', userId)
      .is('used_at', null);

    if (error) throw error;
  }

  async createRefreshSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshSession> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('refresh_sessions')
      .insert([{ user_id: userId, token_hash: tokenHash, expires_at: expiresAt.toISOString() }] as never[])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async findRefreshSession(sessionId: string): Promise<RefreshSession | null> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('refresh_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async rotateRefreshSession(
    sessionId: string,
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
  ): Promise<RefreshSession | null> {
    const supabase = getSupabaseService();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('refresh_sessions')
      .update({
        token_hash: nextTokenHash,
        expires_at: nextExpiresAt.toISOString(),
        last_used_at: now,
        updated_at: now,
      } as never)
      .eq('id', sessionId)
      .eq('token_hash', currentTokenHash)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async revokeRefreshSession(sessionId: string, tokenHash?: string): Promise<void> {
    const supabase = getSupabaseService();
    let query = supabase
      .from('refresh_sessions')
      .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq('id', sessionId);

    if (tokenHash) {
      query = query.eq('token_hash', tokenHash);
    }

    const { error } = await query;
    if (error) throw error;
  }

  async revokeAllRefreshSessionsForUser(userId: string): Promise<void> {
    const supabase = getSupabaseService();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('refresh_sessions')
      .update({ revoked_at: now, updated_at: now } as never)
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error) throw error;
  }

  /**
   * Delete expired tokens (cleanup).
   */
  async deleteExpiredTokens(): Promise<number> {
    const supabase = getSupabaseService();
    const now = new Date().toISOString();

    // Delete expired verification tokens
    const { count: verCount, error: verError } = await supabase
      .from('email_verification_tokens')
      .delete()
      .lt('expires_at', now)
      .not('used_at', 'is', null);

    if (verError) throw verError;

    // Delete expired password reset tokens
    const { count: resetCount, error: resetError } = await supabase
      .from('password_reset_tokens')
      .delete()
      .lt('expires_at', now)
      .not('used_at', 'is', null);

    if (resetError) throw resetError;

    return (verCount ?? 0) + (resetCount ?? 0);
  }
}
