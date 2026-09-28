import { supabase } from './supabase';

/**
 * Sharing runs straight against Supabase: it works with membership and invite
 * rows rather than with a kesht's members, rounds or payments, so it does not
 * belong in the bundle store.
 */

export type Collaborator = {
  id: string;
  userId: string | null;
  role: 'owner' | 'viewer';
  /** Pending invites have no userId yet; joined people keep the invited address. */
  email: string | null;
  createdAt: string;
};

export type InviteLink = {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

type MemberRow = {
  id: string;
  user_id: string | null;
  role: 'owner' | 'viewer';
  invited_email: string | null;
  created_at: string;
};

type InviteRow = {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

function client() {
  if (!supabase) throw new Error('sharing_cloud_only');
  return supabase;
}

export function inviteUrl(token: string): string {
  const origin = globalThis.location?.origin ?? '';
  return `${origin}/invite/${token}`;
}

export async function listCollaborators(keshtId: string): Promise<Collaborator[]> {
  const { data, error } = await client()
    .from('kesht_members')
    .select('id, user_id, role, invited_email, created_at')
    .eq('kesht_id', keshtId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MemberRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    email: row.invited_email,
    createdAt: row.created_at,
  }));
}

/** Adds a pending invite that becomes real access when that address signs up. */
export async function inviteByEmail(keshtId: string, email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) throw new Error('email_invalid');
  const { error } = await client()
    .from('kesht_members')
    .insert({ kesht_id: keshtId, user_id: null, role: 'viewer', invited_email: trimmed });
  if (error) throw new Error(error.message);
}

export async function removeCollaborator(membershipId: string): Promise<void> {
  const { error } = await client().from('kesht_members').delete().eq('id', membershipId);
  if (error) throw new Error(error.message);
}

export async function listInviteLinks(keshtId: string): Promise<InviteLink[]> {
  const { data, error } = await client()
    .from('kesht_invites')
    .select('id, token, expires_at, created_at')
    .eq('kesht_id', keshtId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as InviteRow[]).map((row) => ({
    id: row.id,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function createInviteLink(keshtId: string): Promise<InviteLink> {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('not_authenticated');
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { data, error } = await db
    .from('kesht_invites')
    .insert({ kesht_id: keshtId, token, created_by: auth.user.id })
    .select('id, token, expires_at, created_at')
    .single();
  if (error) throw new Error(error.message);
  const row = data as InviteRow;
  return { id: row.id, token: row.token, expiresAt: row.expires_at, createdAt: row.created_at };
}

export async function revokeInviteLink(inviteId: string): Promise<void> {
  const { error } = await client()
    .from('kesht_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}

/** Joins the signed-in user to a shared kesht and returns its id. */
export async function redeemInvite(token: string): Promise<string> {
  const { data, error } = await client().rpc('redeem_invite', { p_token: token });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}
