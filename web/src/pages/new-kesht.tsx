import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { notify } from '../components/toasts';
import { Button, Field, Screen } from '../components/ui';
import { store } from '../data/store';
import { gregorianToSolar, SOLAR_MONTHS } from '../lib/calendar';
import { localizeNumber, parseAmount } from '../lib/format';
import { useApp } from '../state/app-state';

const today = gregorianToSolar(new Date());

export function NewKeshtPage() {
  const { t, language, errorFrom } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('1000');
  const [year, setYear] = useState(String(today.year));
  const [month, setMonth] = useState(today.month);
  const [error, setError] = useState('');

  function save(event: FormEvent): void {
    event.preventDefault();
    setError('');
    try {
      const id = store.createKesht({
        name,
        monthlyAmount: parseAmount(amount),
        startYear: parseAmount(year),
        startMonth: month,
      });
      notify(t('notifyKeshtCreated'));
      navigate(`/k/${id}`, { replace: true });
    } catch (caught) {
      setError(errorFrom(caught, 'month_invalid'));
    }
  }

  return (
    <Screen
      title={t('newKesht')}
      backTo="/"
      form={{ id: 'new-kesht-form', onSubmit: save }}
      footer={<Button type="submit" label={t('save')} />}
    >
      <>
        <Field label={t('keshtName')} value={name} onChange={setName} autoFocus required />
        <Field label={t('monthlyAmount')} value={amount} onChange={setAmount} inputMode="numeric" required />
        <Field label={t('year')} value={year} onChange={setYear} inputMode="numeric" required />
        <span className="label">{t('startMonth')}</span>
        <div className="month-grid">
          {SOLAR_MONTHS.map((entry, index) => {
            const selected = month === index + 1;
            return (
              <button
                key={entry.en}
                type="button"
                className={`month-pick${selected ? ' selected' : ''}`}
                onClick={() => setMonth(index + 1)}
                aria-pressed={selected}
              >
                {entry[language]}
              </button>
            );
          })}
        </div>
        <span className="muted">{localizeNumber(month, language)}</span>
        {error ? <span className="danger-text">{error}</span> : null}
      </>
    </Screen>
  );
}
