import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import type { DbUser } from '@pidec/db-types';

export interface VerificationUpdatePatch {
  verification_status?: 'pending' | 'verified' | 'rejected' | 'flagged' | 'suspended';
  verification_method?: 'groq' | 'gemini' | 'manual' | null;
  verification_timestamp?: string | null;
  verification_attempts?: number;
  last_verification_attempt_at?: string | null;
}

/**
 * Authentication repository — handles all auth-related database queries.
 */
export class AuthRepository {
  /**
   * Find user by email.
   */
  async findByEmail(email: string): Promise<DbUser | null> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Find user by ID.
   */
  async findById(id: string): Promise<DbUser | null> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Create a new user (typically for registration).
   * Password hash must be pre-hashed before calling this.
   */
  async createUser(
    email: string,
    passwordHash: string,
    name: string,
    role: 'student' | 'admin' | 'judge' = 'student',
    matricNumber?: string,
    department?: string,
    level?: number,
  ): Promise<DbUser> {
    const supabase = getSupabaseService();
    const userData: Record<string, unknown> = {
      email,
      password_hash: passwordHash,
      name,
      role,
    };

    if (matricNumber) userData.matric_number = matricNumber;
    if (department) userData.department = department;
    if (level) userData.level = level;

    const { data, error } = await supabase
      .from('users')
      .insert([userData] as never[])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user's password hash.
   */
  async updatePasswordHash(userId: string, passwordHash: string): Promise<DbUser> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash } as never)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark a user's email as verified without changing document verification state.
   */
  async markEmailVerified(userId: string): Promise<DbUser> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('users')
      .update({
        email_verified_at: new Date().toISOString(),
      } as never)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateVerificationState(userId: string, patch: VerificationUpdatePatch): Promise<DbUser> {
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from('users')
      .update(patch as never)
      .eq('id', userId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}
