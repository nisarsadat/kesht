import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { WebKeshtRepository } from './web-repository';
import { createId } from '../domain/rules';
import {
  addMember,
  joinMember,
  closeRound,
  createKesht,
  moveMember,
  removeMember,
  setPaid,
  setRecipient,
  startKesht,
  updateMember,
} from '../domain/rules';
import type { Bundle, CreateKeshtInput, Kesht, KeshtStatus, KeshtSummary, Language, Member, MemberInput, Payment, Round } from '../domain/types';
import type { ThemeName } from '../theme';

type KeshtRow = {
  id: string;
  name: string;
  monthly_amount: number;
  currency: 'AFN';
  start_year: number;
  start_month: number;
  status: KeshtStatus;
  created_at: string;
  updated_at: string;
};

type MemberRow = {
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

type RoundRow = {
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

type PaymentRow = {
  id: string;
  round_id: string;
  member_id: string;
  amount: number;
  paid: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapKesht(row: KeshtRow): Kesht {
  return {
    id: row.id,
    name: row.name,
    monthlyAmount: row.monthly_amount,
    currency: 'AFN',
    startYear: row.start_year,
    startMonth: row.start_month,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    roundId: row.round_id,
    memberId: row.member_id,
    amount: row.amount,
    paid: row.paid === 1,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function persist(db: SQLite.SQLiteDatabase, bundle: Bundle): Promise<void> {
  const kesht = bundle.kesht;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO keshts (id, name, monthly_amount, currency, start_year, start_month, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         monthly_amount = excluded.monthly_amount,
         status = excluded.status,
         updated_at = excluded.updated_at`,
      kesht.id,
      kesht.name,
      kesht.monthlyAmount,
      kesht.currency,
      kesht.startYear,
      kesht.startMonth,
      kesht.status,
      kesht.createdAt,
      kesht.updatedAt,
    );
    await db.runAsync('DELETE FROM payments WHERE round_id IN (SELECT id FROM rounds WHERE kesht_id = ?)', kesht.id);
    await db.runAsync('DELETE FROM rounds WHERE kesht_id = ?', kesht.id);
    await db.runAsync('DELETE FROM members WHERE kesht_id = ?', kesht.id);
    for (const member of bundle.members) {
      await db.runAsync(
        `INSERT INTO members (id, kesht_id, name, father_name, phone, note, turn_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        member.id,
        member.keshtId,
        member.name,
        member.fatherName,
        member.phone,
        member.note,
        member.turnOrder,
        member.createdAt,
        member.updatedAt,
      );
    }
    for (const round of bundle.rounds) {
      await db.runAsync(
        `INSERT INTO rounds (id, kesht_id, sequence, year, month, recipient_member_id, status, closed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        round.id,
        round.keshtId,
        round.sequence,
        round.year,
        round.month,
        round.recipientMemberId,
        round.status,
        round.closedAt,
        round.createdAt,
        round.updatedAt,
      );
    }
    for (const payment of bundle.payments) {
      await db.runAsync(
        `INSERT INTO payments (id, round_id, member_id, amount, paid, paid_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        payment.id,
        payment.roundId,
        payment.memberId,
        payment.amount,
        payment.paid ? 1 : 0,
        payment.paidAt,
        payment.createdAt,
        payment.updatedAt,
      );
    }
  });
}

export class KeshtRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async getLanguage(): Promise<Language> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'language');
    return row?.value === 'en' ? 'en' : 'fa';
  }

  async setLanguage(language: Language): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      'language',
      language,
    );
  }

  async getTheme(): Promise<ThemeName> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'theme');
    return row?.value === 'light' ? 'light' : 'dark';
  }

  async setTheme(theme: ThemeName): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      'theme',
      theme,
    );
  }

  async listKeshts(): Promise<KeshtSummary[]> {
    const rows = await this.db.getAllAsync<KeshtSummary & { member_count: number; open_sequence: number | null }>(
      `SELECT k.id, k.name, k.monthly_amount AS monthlyAmount, k.status,
              (SELECT COUNT(*) FROM members m WHERE m.kesht_id = k.id) AS memberCount,
              (SELECT r.sequence FROM rounds r WHERE r.kesht_id = k.id AND r.status = 'open' LIMIT 1) AS openSequence
       FROM keshts k
       ORDER BY k.updated_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      monthlyAmount: row.monthlyAmount,
      status: row.status,
      memberCount: row.memberCount,
      openSequence: row.openSequence,
    }));
  }

  async getBundle(keshtId: string): Promise<Bundle | null> {
    const keshtRow = await this.db.getFirstAsync<KeshtRow>('SELECT * FROM keshts WHERE id = ?', keshtId);
    if (!keshtRow) return null;
    const members = await this.db.getAllAsync<MemberRow>('SELECT * FROM members WHERE kesht_id = ? ORDER BY turn_order ASC', keshtId);
    const rounds = await this.db.getAllAsync<RoundRow>('SELECT * FROM rounds WHERE kesht_id = ? ORDER BY sequence ASC', keshtId);
    const payments = rounds.length
      ? await this.db.getAllAsync<PaymentRow>(
          `SELECT * FROM payments WHERE round_id IN (${rounds.map(() => '?').join(',')})`,
          ...rounds.map((round) => round.id),
        )
      : [];
    return {
      kesht: mapKesht(keshtRow),
      members: members.map(mapMember),
      rounds: rounds.map(mapRound),
      payments: payments.map(mapPayment),
    };
  }

  async createKesht(input: CreateKeshtInput): Promise<string> {
    const now = new Date().toISOString();
    const kesht = createKesht(input, now, createId());
    await persist(this.db, { kesht, members: [], rounds: [], payments: [] });
    return kesht.id;
  }

  private async mutate(keshtId: string, change: (bundle: Bundle) => Bundle): Promise<void> {
    const bundle = await this.getBundle(keshtId);
    if (!bundle) throw new Error('kesht_not_found');
    await persist(this.db, change(bundle));
  }

  addMember(keshtId: string, input: MemberInput): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => addMember(bundle, input, now, createId()));
  }

  joinMember(keshtId: string, input: MemberInput): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => joinMember(bundle, input, now, createId(), createId));
  }

  updateMember(keshtId: string, memberId: string, input: MemberInput): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => updateMember(bundle, memberId, input, now));
  }

  removeMember(keshtId: string, memberId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => removeMember(bundle, memberId, now));
  }

  moveMember(keshtId: string, memberId: string, direction: 'up' | 'down'): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => moveMember(bundle, memberId, direction, now));
  }

  startKesht(keshtId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => startKesht(bundle, now, createId));
  }

  setPaid(keshtId: string, paymentId: string, paid: boolean): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => setPaid(bundle, paymentId, paid, now));
  }

  setAllPaid(keshtId: string, paid: boolean): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => {
      const open = bundle.rounds.find((round) => round.status === 'open');
      if (!open) return bundle;
      return bundle.payments
        .filter((payment) => payment.roundId === open.id)
        .reduce((current, payment) => setPaid(current, payment.id, paid, now), bundle);
    });
  }

  setRecipient(keshtId: string, memberId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => setRecipient(bundle, memberId, now));
  }

  closeRound(keshtId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => closeRound(bundle, now, createId));
  }
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync('kesht.db');
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS keshts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          monthly_amount INTEGER NOT NULL,
          currency TEXT NOT NULL,
          start_year INTEGER NOT NULL,
          start_month INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY NOT NULL,
          kesht_id TEXT NOT NULL,
          name TEXT NOT NULL,
          father_name TEXT,
          phone TEXT,
          note TEXT,
          turn_order INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rounds (
          id TEXT PRIMARY KEY NOT NULL,
          kesht_id TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          recipient_member_id TEXT,
          status TEXT NOT NULL,
          closed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY NOT NULL,
          round_id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          paid INTEGER NOT NULL,
          paid_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return databasePromise;
}

export type KeshtStore = KeshtRepository | WebKeshtRepository;

export async function createRepository(): Promise<KeshtStore> {
  if (Platform.OS === 'web') return new WebKeshtRepository();
  return new KeshtRepository(await openDatabase());
}
