import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/app-state';

type ChipIconName = 'sun' | 'moon' | 'globe';

/**
 * Icon-only header chips. Drawn inline with the tab bar's stroke style so the
 * app keeps one visual language without pulling in an icon dependency.
 */
function ChipIcon({ name }: { name: ChipIconName }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  // The theme chip shows the theme it would switch to: sun while dark, moon while light.
  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
      </svg>
    );
  }
  if (name === 'moon') {
    return (
      <svg {...common}>
        <path d="M20.5 13.6A8.5 8.5 0 1 1 10.4 3.5a6.6 6.6 0 0 0 10.1 10.1z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <ellipse cx="12" cy="12" rx="4.2" ry="9" />
    </svg>
  );
}

export function Screen({
  title,
  children,
  footer,
  inTabs = false,
  backTo,
  form,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  inTabs?: boolean;
  backTo?: string;
  /**
   * Wraps the content and the footer in one <form>, so a submit button in the
   * footer is a real descendant of it and Enter/Save work natively.
   */
  form?: { id: string; onSubmit: (event: FormEvent) => void };
}) {
  const { direction, language, setLanguage, theme, setTheme, t } = useApp();

  const body = (
    <>
      <div className={inTabs ? 'content with-tabs' : 'content'}>{children}</div>
      {footer ? <div className="footer">{footer}</div> : null}
    </>
  );

  return (
    <div className="page" dir={direction}>
      <header className="header">
        <div className="header-side">
          {backTo ? (
            <Link className="back-link" to={backTo}>
              {t('back')}
            </Link>
          ) : null}
        </div>
        <h1 className="header-title">{title}</h1>
        <div className="header-side end">
          <button
            type="button"
            className="chip icon-only"
            aria-label={theme === 'dark' ? t('themeLight') : t('themeDark')}
            title={theme === 'dark' ? t('themeLight') : t('themeDark')}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <ChipIcon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          {/* Switches to the other language; the label names that language. */}
          <button
            type="button"
            className="chip icon-only"
            lang={language === 'fa' ? 'en' : 'fa'}
            aria-label={language === 'fa' ? t('english') : t('dari')}
            title={language === 'fa' ? t('english') : t('dari')}
            onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
          >
            <ChipIcon name="globe" />
          </button>
        </div>
      </header>
      {form ? (
        <form id={form.id} className="page-form" onSubmit={form.onSubmit}>
          {body}
        </form>
      ) : (
        body
      )}
    </div>
  );
}

export function Card({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  if (!onClick) {
    return (
      <div className="card" style={style}>
        {children}
      </div>
    );
  }
  const activate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <div className="card clickable" role="button" tabIndex={0} onClick={onClick} onKeyDown={activate} style={style}>
      {children}
    </div>
  );
}

const buttonClass = (tone: 'primary' | 'ghost' | 'danger', small: boolean): string =>
  `button${tone === 'ghost' ? ' ghost' : ''}${tone === 'danger' ? ' danger' : ''}${small ? ' small' : ''}`;

export function Button({
  label,
  onClick,
  to,
  tone = 'primary',
  disabled = false,
  type = 'button',
  small = false,
}: {
  label: string;
  onClick?: () => void;
  /** Renders a router link styled as a button. */
  to?: string;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  small?: boolean;
}) {
  if (to) {
    return (
      <Link className={buttonClass(tone, small)} to={to}>
        {label}
      </Link>
    );
  }
  return (
    <button type={type} className={buttonClass(tone, small)} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export function Badge({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'green' | 'stone' }) {
  return <span className={`badge${tone === 'gold' ? '' : ` ${tone}`}`}>{label}</span>;
}

export function Field({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  inputMode,
  multiline = false,
  required = false,
  autoFocus = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: 'numeric' | 'tel' | 'text';
  multiline?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const { language } = useApp();
  const align: CSSProperties = { textAlign: language === 'fa' ? 'right' : 'left' };

  return (
    <label className="field">
      <span className="label">
        {label}
        {hint ? <span className="hint"> · {hint}</span> : null}
      </span>
      {multiline ? (
        <textarea
          className="input"
          style={align}
          rows={3}
          value={value}
          required={required}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="input"
          style={align}
          type={type}
          inputMode={inputMode}
          value={value}
          required={required}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
