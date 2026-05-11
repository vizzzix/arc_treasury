import { supabaseAdmin } from './supabase';
import type { VercelRequest } from '@vercel/node';

interface AuthResult {
  userId: string;
  email?: string;
}

export async function authenticateUser(req: VercelRequest): Promise<AuthResult | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token || !supabaseAdmin) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return { userId: user.id, email: user.email };
}

export async function verifyWalletOwnership(userId: string, walletId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from('user_wallets')
    .select('id')
    .eq('user_id', userId)
    .or(`wallet_id.eq.${walletId},arc_wallet_id.eq.${walletId}`)
    .maybeSingle();

  return !!data;
}

export async function upsertUserWallet(
  userId: string,
  walletId: string | null,
  arcWalletId: string | null,
  address: string
): Promise<void> {
  if (!supabaseAdmin) return;

  await supabaseAdmin.from('user_wallets').upsert(
    {
      user_id: userId,
      wallet_id: walletId,
      arc_wallet_id: arcWalletId,
      address: address.toLowerCase(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}
