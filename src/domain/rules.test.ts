import { addMember, closeRound, collectedAmount, createKesht, eligibleRecipients, expectedPot, joinMember, moveMember, nextInOrder, receivedMemberIds, removeMember, setPaid, setRecipient, startKesht, updateMember } from './rules';
import { KeshtRuleError, type Bundle } from './types';

function check(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function expectCode(run: () => void, code: string): void {
  try {
    run();
  } catch (error) {
    check(error instanceof KeshtRuleError && error.code === code, `expected ${code}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

const now = '2026-09-24T00:00:00.000Z';
let seq = 0;
const id = () => `id-${++seq}`;

function draft(): Bundle {
  const kesht = createKesht({ name: 'خانواده', monthlyAmount: 1000, startYear: 1405, startMonth: 7 }, now, id());
  return { kesht, members: [], rounds: [], payments: [] };
}

function withMembers(count: number): Bundle {
  let bundle = draft();
  for (let i = 1; i <= count; i += 1) {
    bundle = addMember(bundle, { name: `Person ${i}`, fatherName: i === 1 ? 'Father' : '  ', phone: '', note: 'n' }, now, id());
  }
  return bundle;
}

expectCode(() => createKesht({ name: '  ', monthlyAmount: 1000, startYear: 1405, startMonth: 1 }, now, id()), 'name_required');
expectCode(() => createKesht({ name: 'A', monthlyAmount: 0, startYear: 1405, startMonth: 1 }, now, id()), 'amount_invalid');

let one = withMembers(1);
expectCode(() => startKesht(one, now, id), 'need_two_members');

let bundle = withMembers(3);
check(bundle.members[0].fatherName === 'Father', 'father name');
check(bundle.members[1].fatherName === null, 'blank father');
check(bundle.members[1].phone === null, 'blank phone');

bundle = moveMember(bundle, bundle.members[2].id, 'up', now);
check(bundle.members.find((member) => member.name === 'Person 3')?.turnOrder === 2, 'turn order');

bundle = updateMember(bundle, bundle.members[0].id, { name: 'Person 1', note: 'updated' }, now);
check(bundle.members[0].note === 'updated', 'note');

const removedId = bundle.members[1].id;
bundle = removeMember(bundle, removedId, now);
check(bundle.members.length === 2, 'member count');
bundle = addMember(bundle, { name: 'Person 3b' }, now, id());

bundle = startKesht(bundle, now, id);
check(bundle.kesht.status === 'active', 'active');
check(bundle.rounds.length === 1, 'one round');
check(bundle.payments.length === 3, 'three payments');
check(bundle.rounds[0].month === 7, 'start month');
expectCode(() => addMember(bundle, { name: 'Late' }, now, id()), 'members_locked');

const first = nextInOrder(bundle);
check(first, 'next recipient');
bundle = setRecipient(bundle, first!.id, now);
for (const payment of bundle.payments) {
  bundle = setPaid(bundle, payment.id, true, now);
}
check(collectedAmount(bundle, bundle.rounds[0].id) === 3000, 'pot');

bundle = closeRound(bundle, now, id);
check(bundle.kesht.status === 'active', 'still active');
check(bundle.rounds.length === 2, 'second round');
check(bundle.rounds[1].month === 8, 'next month');
const pastPayments = bundle.payments.filter((payment) => payment.roundId === bundle.rounds[1].id);
check(pastPayments.length === 3, 'everyone still pays');
check(pastPayments.some((payment) => payment.memberId === first!.id), 'recipient still pays');
expectCode(() => setRecipient(bundle, first!.id, now), 'already_received');
check(!eligibleRecipients(bundle).some((member) => member.id === first!.id), 'not eligible again');

const second = nextInOrder(bundle)!;
bundle = setRecipient(bundle, second.id, now);
bundle = closeRound(bundle, now, id);
const third = nextInOrder(bundle)!;
bundle = setRecipient(bundle, third.id, now);
bundle = closeRound(bundle, now, id);
check(bundle.kesht.status === 'completed', 'completed');
check(bundle.rounds.filter((round) => round.status === 'closed').length === 3, 'three closed');
check(eligibleRecipients(bundle).length === 0, 'nobody left');

const open = startKesht(withMembers(2), now, id);
expectCode(() => closeRound(open, now, id), 'recipient_required');

let late = withMembers(13);
late = startKesht(late, now, id);
for (let month = 0; month < 3; month += 1) {
  const recipient = nextInOrder(late)!;
  late = setRecipient(late, recipient.id, now);
  for (const payment of late.payments.filter((item) => item.roundId === late.rounds.find((round) => round.status === 'open')!.id)) {
    late = setPaid(late, payment.id, true, now);
  }
  late = closeRound(late, now, id);
}
check(late.rounds.filter((round) => round.status === 'closed').length === 3, 'three months gone');
check(eligibleRecipients(late).length === 10, 'ten people left');
late = joinMember(late, { name: 'New' }, now, id(), id);
check(late.members.length === 14, 'joined');
check(eligibleRecipients(late).length === 11, 'eleven months left');
const newbie = late.members.find((member) => member.name === 'New')!;
const backDues = late.payments.filter((payment) => payment.memberId === newbie.id && late.rounds.some((round) => round.id === payment.roundId && round.status === 'closed'));
check(backDues.length === 3, 'pays each past month');
check(backDues.every((payment) => payment.amount === 1000 && !payment.paid), 'unpaid catch-up');
check(expectedPot(late) === 14000, 'pot grows by the new person');
expectCode(() => joinMember({ ...late, kesht: { ...late.kesht, status: 'completed' } }, { name: 'Nope' }, now, id(), id), 'not_active');

const renamed = updateMember(late, late.members[0].id, { name: 'Renamed' }, now);
check(renamed.members[0].name === 'Renamed', 'edit name after start');
check(renamed.kesht.monthlyAmount === 1000, 'amount stays equal');
const waiting = eligibleRecipients(late)[0];
const dropped = removeMember(late, waiting.id, now);
check(dropped.members.length === 13, 'deleted a person who has not received');
check(!dropped.payments.some((payment) => payment.memberId === waiting.id), 'their payments go too');
const taken = [...receivedMemberIds(late)][0];
expectCode(() => removeMember(late, taken, now), 'already_received');

console.log('kesht rules ok');
