export type Language = 'fa' | 'en';

export type KeshtStatus = 'draft' | 'active' | 'completed';

export type RoundStatus = 'open' | 'closed';

export type Kesht = {
  id: string;
  name: string;
  monthlyAmount: number;
  currency: 'AFN';
  startYear: number;
  startMonth: number;
  status: KeshtStatus;
  createdAt: string;
  updatedAt: string;
};

export type Member = {
  id: string;
  keshtId: string;
  name: string;
  fatherName: string | null;
  phone: string | null;
  note: string | null;
  turnOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Round = {
  id: string;
  keshtId: string;
  sequence: number;
  year: number;
  month: number;
  recipientMemberId: string | null;
  status: RoundStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  roundId: string;
  memberId: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Bundle = {
  kesht: Kesht;
  members: Member[];
  rounds: Round[];
  payments: Payment[];
};

export type KeshtSummary = {
  id: string;
  name: string;
  monthlyAmount: number;
  status: KeshtStatus;
  memberCount: number;
  openSequence: number | null;
};

export type MemberInput = {
  name: string;
  fatherName?: string | null;
  phone?: string | null;
  note?: string | null;
};

export type CreateKeshtInput = {
  name: string;
  monthlyAmount: number;
  startYear: number;
  startMonth: number;
};

export type RuleCode =
  | 'name_required'
  | 'amount_invalid'
  | 'month_invalid'
  | 'need_two_members'
  | 'members_locked'
  | 'not_draft'
  | 'not_active'
  | 'member_not_found'
  | 'round_not_open'
  | 'recipient_required'
  | 'already_received'
  | 'payment_not_found';

export class KeshtRuleError extends Error {
  code: RuleCode;

  constructor(code: RuleCode) {
    super(code);
    this.code = code;
    this.name = 'KeshtRuleError';
  }
}
