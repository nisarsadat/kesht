import type { Bundle, Kesht, KeshtStatus, Member, Payment, Round } from '../domain/types';

/**
 * Translation between the app's camelCase domain objects and the snake_case
 * Postgres columns. The phone app has the same pairs in src/db/repository.ts.
 */

export type KeshtRow = {
  id: string;
  user_id: string;
  name: string;
  monthly_amount: number;
  currency: string;
  start_year: number;
  start_month: number;
  status: KeshtStatus;
  created_at: string;
  updated_at: string;
};

export type MemberRow = {
  id: string;
  kesht_id: string;
  name: string;
  father_name: string | null;
  phone: string | null;
  note: string | null;
  turn_order: number;
  created_at: string;
  updated_at: string;
};

export type RoundRow = {
  id: string;
  kesht_id: string;
  sequence: number;
  year: number;
  month: number;
  recipient_member_id: string | null;
  status: 'open' | 'closed';
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  round_id: string;
  member_id: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Postgres hands back `2026-09-26T10:00:00+00:00`; normalise so string sorting is stable. */
function iso(value: string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function mapKesht(row: KeshtRow): Kesht {
  return {
    id: row.id,
    name: row.name,
    monthlyAmount: row.monthly_amount,
    currency: 'AFN',
    startYear: row.start_year,
    startMonth: row.start_month,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    keshtId: row.kesht_id,
    name: row.name,
    fatherName: row.father_name,
    phone: row.phone,
    note: row.note,
    turnOrder: row.turn_order,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapRound(row: RoundRow): Round {
  return {
    id: row.id,
    keshtId: row.kesht_id,
    sequence: row.sequence,
    year: row.year,
    month: row.month,
    recipientMemberId: row.recipient_member_id,
    status: row.status,
    closedAt: isoOrNull(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    roundId: row.round_id,
    memberId: row.member_id,
    amount: row.amount,
    paid: row.paid === true,
    paidAt: isoOrNull(row.paid_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** Groups the four flat tables into one bundle per kesht, ready for the UI. */
export function assembleBundles(
  keshtRows: KeshtRow[],
  memberRows: MemberRow[],
  roundRows: RoundRow[],
  paymentRows: PaymentRow[],
): Record<string, Bundle> {
  const bundles: Record<string, Bundle> = {};
  for (const row of keshtRows) {
    bundles[row.id] = { kesht: mapKesht(row), members: [], rounds: [], payments: [] };
  }
  for (const row of memberRows) {
    bundles[row.kesht_id]?.members.push(mapMember(row));
  }
  const keshtByRound: Record<string, string> = {};
  for (const row of roundRows) {
    keshtByRound[row.id] = row.kesht_id;
    bundles[row.kesht_id]?.rounds.push(mapRound(row));
  }
  for (const row of paymentRows) {
    const keshtId = keshtByRound[row.round_id];
    if (keshtId) bundles[keshtId]?.payments.push(mapPayment(row));
  }
  return bundles;
}

// ---------------------------------------------------------------------------
// Outbound payloads for save_kesht_bundle()
// ---------------------------------------------------------------------------

export function keshtPayload(kesht: Kesht): Record<string, unknown> {
  return {
    id: kesht.id,
    name: kesht.name,
    monthly_amount: kesht.monthlyAmount,
    currency: kesht.currency,
    start_year: kesht.startYear,
    start_month: kesht.startMonth,
    status: kesht.status,
    created_at: kesht.createdAt,
    updated_at: kesht.updatedAt,
  };
}

export function memberPayload(member: Member): Record<string, unknown> {
  return {
    id: member.id,
    name: member.name,
    father_name: member.fatherName,
    phone: member.phone,
    note: member.note,
    turn_order: member.turnOrder,
    created_at: member.createdAt,
    updated_at: member.updatedAt,
  };
}

export function roundPayload(round: Round): Record<string, unknown> {
  return {
    id: round.id,
    sequence: round.sequence,
    year: round.year,
    month: round.month,
    recipient_member_id: round.recipientMemberId,
    status: round.status,
    closed_at: round.closedAt,
    created_at: round.createdAt,
    updated_at: round.updatedAt,
  };
}

export function paymentPayload(payment: Payment): Record<string, unknown> {
  return {
    id: payment.id,
    round_id: payment.roundId,
    member_id: payment.memberId,
    amount: payment.amount,
    paid: payment.paid,
    paid_at: payment.paidAt,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  };
}
