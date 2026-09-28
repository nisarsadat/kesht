import { supabase } from './supabase';

/**
 * Super-admin calls. Everything here is enforced on the server by row level
 * security and the admin RPCs; this module only talks to them. A non-admin
 * calling any of these gets a clear `not_admin` refusal instead of silent
 * empty lists.
 */

export type AdminUser = {
  userId: string;
  email: string | null;
  createdAt: string;
};

export type AdminKesht = {
  keshtId: string;
  name: string;
  status: string;
  ownerEmail: string | null;
  memberCount: number;
  roundCount: number;
  createdAt: string;
};

type UserRow = {
  user_id: string;
  email: string | null;
  created_at: string;
};

type KeshtRow = {
  kesht_id: string;
  name: string;
  status: string;
  owner_email: string | null;
  member_count: number;
  round_count: number;
  created_at: string;
};

function client() {
  if (!supabase) throw new Error('sharing_cloud_only');
  return supabase;
}

/** True when the signed-in account has a row in `app_admins`. */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await client()
    .from('app_admins')
    .select('user_id')
    .eq('user_id', (await client().auth.getUser()).data.user?.id ?? '')
    .maybeSingle();
  if (error) {
    // A table that does not exist yet (migration not applied) must not break
    // the app; it just means "not an admin".
    if (error.code === 'PGRST205' || error.code === '42P01') return false;
    throw new Error(error.message);
  }
  return data !== null;
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const { data, error } = await client().rpc('admin_list_users');
  if (error) throw new Error(error.message);
  return ((data ?? []) as UserRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    createdAt: row.created_at,
  }));
}

export async function adminListKeshts(): Promise<AdminKesht[]> {
  const { data, error } = await client().rpc('admin_list_keshts');
  if (error) throw new Error(error.message);
  return ((data ?? []) as KeshtRow[]).map((row) => ({
    keshtId: row.kesht_id,
    name: row.name,
    status: row.status,
    ownerEmail: row.owner_email,
    memberCount: row.member_count,
    roundCount: row.round_count,
    createdAt: row.created_at,
  }));
}

export async function adminDeleteKesht(keshtId: string): Promise<void> {
  const { error } = await client().rpc('admin_delete_kesht', { p_kesht_id: keshtId });
  if (error) throw new Error(error.message);
}
