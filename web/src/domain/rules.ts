import type {
  Bundle,
  CreateKeshtInput,
  Kesht,
  Member,
  MemberInput,
  Payment,
  Round,
} from './types';
import { KeshtRuleError } from './types';

export function createId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function assertDraft(bundle: Bundle): void {
  if (bundle.kesht.status !== 'draft') {
    throw new KeshtRuleError('members_locked');
  }
}

/**
 * A comparison key for member names.
 *
 * The same person gets typed several ways — the Arabic and Persian forms of
 * yeh and kaf, a zero-width joiner in the middle of a Dari name, stray spaces,
 * or different capitalisation in English. All of those describe one person, and
 * a member appearing twice under two spellings would hand the money out twice,
 * so the key normalises them away before names are compared.
 */
export function memberNameKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0649\u064A]/g, '\u06CC') // alef maksura / Arabic yeh -> Persian yeh
    .replace(/\u0643/g, '\u06A9') // Arabic kaf -> Persian keheh
    .replace(/\u0629/g, '\u0647') // teh marbuta -> heh
    .replace(/[\u200B-\u200D\u0640\u064B-\u0652\u0670]/g, '') // joiners, tatweel, diacritics
    .replace(/\s+/g, '');
}

/** Names must be unique within one kesht, so one person can only hold one turn. */
function assertUniqueName(members: Member[], name: string, exceptMemberId?: string): void {
  const key = memberNameKey(name);
  const clash = members.some((member) => member.id !== exceptMemberId && memberNameKey(member.name) === key);
  if (clash) throw new KeshtRuleError('duplicate_name');
}

function sortMembers(members: Member[]): Member[] {
  return [...members].sort((a, b) => a.turnOrder - b.turnOrder || a.createdAt.localeCompare(b.createdAt));
}

export function createKesht(input: CreateKeshtInput, now: string, id: string): Kesht {
  const name = input.name.trim();
  if (!name) throw new KeshtRuleError('name_required');
  if (!Number.isInteger(input.monthlyAmount) || input.monthlyAmount <= 0) {
    throw new KeshtRuleError('amount_invalid');
  }
  if (!Number.isInteger(input.startMonth) || input.startMonth < 1 || input.startMonth > 12) {
    throw new KeshtRuleError('month_invalid');
  }
  if (!Number.isInteger(input.startYear) || input.startYear < 1300 || input.startYear > 2200) {
    throw new KeshtRuleError('month_invalid');
  }
  return {
    id,
    name,
    monthlyAmount: input.monthlyAmount,
    currency: 'AFN',
    startYear: input.startYear,
    startMonth: input.startMonth,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function addMember(bundle: Bundle, input: MemberInput, now: string, id: string): Bundle {
  assertDraft(bundle);
  const name = input.name.trim();
  if (!name) throw new KeshtRuleError('name_required');
  assertUniqueName(bundle.members, name);
  const nextOrder = bundle.members.reduce((max, member) => Math.max(max, member.turnOrder), 0) + 1;
  const member: Member = {
    id,
    keshtId: bundle.kesht.id,
    name,
    fatherName: blankToNull(input.fatherName),
    phone: blankToNull(input.phone),
    note: blankToNull(input.note),
    turnOrder: nextOrder,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...bundle,
    kesht: { ...bundle.kesht, updatedAt: now },
    members: [...bundle.members, member],
  };
}

export function joinMember(bundle: Bundle, input: MemberInput, now: string, id: string, makeId: () => string): Bundle {
  if (bundle.kesht.status !== 'active') throw new KeshtRuleError('not_active');
  const name = input.name.trim();
  if (!name) throw new KeshtRuleError('name_required');
  assertUniqueName(bundle.members, name);
  const nextOrder = bundle.members.reduce((max, member) => Math.max(max, member.turnOrder), 0) + 1;
  const member: Member = {
    id,
    keshtId: bundle.kesht.id,
    name,
    fatherName: blankToNull(input.fatherName),
    phone: blankToNull(input.phone),
    note: blankToNull(input.note),
    turnOrder: nextOrder,
    createdAt: now,
    updatedAt: now,
  };
  const dues: Payment[] = bundle.rounds.map((round) => ({
    id: makeId(),
    roundId: round.id,
    memberId: member.id,
    amount: bundle.kesht.monthlyAmount,
    paid: false,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  }));
  return {
    ...bundle,
    kesht: { ...bundle.kesht, updatedAt: now },
    members: [...bundle.members, member],
    payments: [...bundle.payments, ...dues],
  };
}

export function updateMember(bundle: Bundle, memberId: string, input: MemberInput, now: string): Bundle {
  if (bundle.kesht.status === 'completed') throw new KeshtRuleError('not_active');
  const name = input.name.trim();
  if (!name) throw new KeshtRuleError('name_required');
  const existing = bundle.members.find((member) => member.id === memberId);
  if (!existing) throw new KeshtRuleError('member_not_found');
  // Keeps the name checked against the others, so renaming onto a colleague
  // cannot quietly create a duplicate.
  assertUniqueName(bundle.members, name, memberId);
  return {
    ...bundle,
    kesht: { ...bundle.kesht, updatedAt: now },
    members: bundle.members.map((member) =>
      member.id === memberId
        ? {
            ...member,
            name,
            fatherName: blankToNull(input.fatherName),
            phone: blankToNull(input.phone),
            note: blankToNull(input.note),
            updatedAt: now,
          }
        : member,
    ),
  };
}

export function removeMember(bundle: Bundle, memberId: string, now: string): Bundle {
  if (bundle.kesht.status === 'completed') throw new KeshtRuleError('not_active');
  if (!bundle.members.some((member) => member.id === memberId)) {
    throw new KeshtRuleError('member_not_found');
  }
  if (bundle.kesht.status === 'active' && receivedMemberIds(bundle).has(memberId)) {
    throw new KeshtRuleError('already_received');
  }
  const remaining = sortMembers(bundle.members.filter((member) => member.id !== memberId)).map((member, index) => ({
    ...member,
    turnOrder: index + 1,
    updatedAt: now,
  }));
  const payments = bundle.payments.filter((payment) => payment.memberId !== memberId);
  const rounds = bundle.rounds.map((round) =>
    round.recipientMemberId === memberId ? { ...round, recipientMemberId: null, updatedAt: now } : round,
  );
  const received = new Set(
    rounds.filter((round) => round.status === 'closed' && round.recipientMemberId).map((round) => round.recipientMemberId as string),
  );
  const finished = bundle.kesht.status === 'active' && remaining.length > 0 && remaining.every((member) => received.has(member.id));
  return {
    ...bundle,
    kesht: { ...bundle.kesht, status: finished ? 'completed' : bundle.kesht.status, updatedAt: now },
    members: remaining,
    rounds: finished ? rounds.map((round) => (round.status === 'open' ? { ...round, status: 'closed' as const, closedAt: now, updatedAt: now } : round)) : rounds,
    payments,
  };
}

export function moveMember(bundle: Bundle, memberId: string, direction: 'up' | 'down', now: string): Bundle {
  assertDraft(bundle);
  const ordered = sortMembers(bundle.members);
  const index = ordered.findIndex((member) => member.id === memberId);
  if (index < 0) throw new KeshtRuleError('member_not_found');
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return bundle;
  const current = ordered[index];
  const other = ordered[swapIndex];
  return {
    ...bundle,
    kesht: { ...bundle.kesht, updatedAt: now },
    members: bundle.members.map((member) => {
      if (member.id === current.id) return { ...member, turnOrder: other.turnOrder, updatedAt: now };
      if (member.id === other.id) return { ...member, turnOrder: current.turnOrder, updatedAt: now };
      return member;
    }),
  };
}

export function receivedMemberIds(bundle: Bundle): Set<string> {
  return new Set(
    bundle.rounds
      .filter((round) => round.status === 'closed' && round.recipientMemberId)
      .map((round) => round.recipientMemberId as string),
  );
}

export function openRound(bundle: Bundle): Round | null {
  return bundle.rounds.find((round) => round.status === 'open') ?? null;
}

export function expectedPot(bundle: Bundle): number {
  return bundle.members.length * bundle.kesht.monthlyAmount;
}

export function collectedAmount(bundle: Bundle, roundId: string): number {
  return bundle.payments
    .filter((payment) => payment.roundId === roundId && payment.paid)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function eligibleRecipients(bundle: Bundle): Member[] {
  const received = receivedMemberIds(bundle);
  return sortMembers(bundle.members).filter((member) => !received.has(member.id));
}

export function nextInOrder(bundle: Bundle): Member | null {
  return eligibleRecipients(bundle)[0] ?? null;
}

function paymentsForRound(round: Round, members: Member[], amount: number, now: string, makeId: () => string): Payment[] {
  return sortMembers(members).map((member) => ({
    id: makeId(),
    roundId: round.id,
    memberId: member.id,
    amount,
    paid: false,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  }));
}

export function startKesht(bundle: Bundle, now: string, makeId: () => string): Bundle {
  if (bundle.kesht.status !== 'draft') throw new KeshtRuleError('not_draft');
  if (bundle.members.length < 2) throw new KeshtRuleError('need_two_members');
  const members = sortMembers(bundle.members).map((member, index) => ({
    ...member,
    turnOrder: index + 1,
    updatedAt: now,
  }));
  const round: Round = {
    id: makeId(),
    keshtId: bundle.kesht.id,
    sequence: 1,
    year: bundle.kesht.startYear,
    month: bundle.kesht.startMonth,
    recipientMemberId: null,
    status: 'open',
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    kesht: { ...bundle.kesht, status: 'active', updatedAt: now },
    members,
    rounds: [round],
    payments: paymentsForRound(round, members, bundle.kesht.monthlyAmount, now, makeId),
  };
}

export function setPaid(bundle: Bundle, paymentId: string, paid: boolean, now: string): Bundle {
  if (bundle.kesht.status !== 'active') throw new KeshtRuleError('not_active');
  const payment = bundle.payments.find((item) => item.id === paymentId);
  if (!payment) throw new KeshtRuleError('payment_not_found');
  const round = bundle.rounds.find((item) => item.id === payment.roundId);
  if (!round) throw new KeshtRuleError('payment_not_found');
  if (round.status === 'open' && openRound(bundle)?.id !== round.id) throw new KeshtRuleError('round_not_open');
  return {
    ...bundle,
    payments: bundle.payments.map((item) =>
      item.id === paymentId ? { ...item, paid, paidAt: paid ? now : null, updatedAt: now } : item,
    ),
  };
}

export function setRecipient(bundle: Bundle, memberId: string, now: string): Bundle {
  if (bundle.kesht.status !== 'active') throw new KeshtRuleError('not_active');
  const current = openRound(bundle);
  if (!current) throw new KeshtRuleError('round_not_open');
  if (!bundle.members.some((member) => member.id === memberId)) {
    throw new KeshtRuleError('member_not_found');
  }
  if (receivedMemberIds(bundle).has(memberId)) throw new KeshtRuleError('already_received');
  return {
    ...bundle,
    rounds: bundle.rounds.map((round) =>
      round.id === current.id ? { ...round, recipientMemberId: memberId, updatedAt: now } : round,
    ),
  };
}

export function closeRound(bundle: Bundle, now: string, makeId: () => string): Bundle {
  if (bundle.kesht.status !== 'active') throw new KeshtRuleError('not_active');
  const current = openRound(bundle);
  if (!current) throw new KeshtRuleError('round_not_open');
  if (!current.recipientMemberId) throw new KeshtRuleError('recipient_required');
  if (receivedMemberIds(bundle).has(current.recipientMemberId)) {
    throw new KeshtRuleError('already_received');
  }
  const closedRounds = bundle.rounds.map((round) =>
    round.id === current.id ? { ...round, status: 'closed' as const, closedAt: now, updatedAt: now } : round,
  );
  const received = new Set(
    closedRounds.filter((round) => round.recipientMemberId).map((round) => round.recipientMemberId as string),
  );
  const everyoneReceived = bundle.members.every((member) => received.has(member.id));
  if (everyoneReceived) {
    return {
      ...bundle,
      kesht: { ...bundle.kesht, status: 'completed', updatedAt: now },
      rounds: closedRounds,
    };
  }
  const nextDate = addMonths(current.year, current.month, 1);
  const nextRound: Round = {
    id: makeId(),
    keshtId: bundle.kesht.id,
    sequence: current.sequence + 1,
    year: nextDate.year,
    month: nextDate.month,
    recipientMemberId: null,
    status: 'open',
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...bundle,
    kesht: { ...bundle.kesht, updatedAt: now },
    rounds: [...closedRounds, nextRound],
    payments: [
      ...bundle.payments,
      ...paymentsForRound(nextRound, bundle.members, bundle.kesht.monthlyAmount, now, makeId),
    ],
  };
}
