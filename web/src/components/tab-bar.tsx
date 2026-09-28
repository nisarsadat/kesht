import { NavLink } from 'react-router-dom';
import type { MessageKey } from '../i18n/messages';
import { useApp } from '../state/app-state';

function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'index') {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === 'members') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-2.6 2.7-4 5.5-4s4.9 1.4 5.5 4" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16.2 15c1.8.3 3.2 1.4 3.8 4" />
      </svg>
    );
  }
  if (name === 'month') {
    return (
      <svg {...common}>
        <path d="M5 6h14v13H5z" />
        <path d="M8 4v4M16 4v4M5 10h14" />
      </svg>
    );
  }
  if (name === 'spin') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 8 8H12z" />
        <path d="M12 12 7 16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

const TABS: { name: string; label: MessageKey; path: string; end?: boolean }[] = [
  { name: 'index', label: 'tabOverview', path: '', end: true },
  { name: 'members', label: 'tabPeople', path: 'members' },
  { name: 'month', label: 'tabMonth', path: 'month' },
  { name: 'spin', label: 'tabSpin', path: 'spin' },
  { name: 'history', label: 'tabHistory', path: 'history' },
];

/** Spin sits in the middle, like on mobile. */
function centered(tabs: typeof TABS): typeof TABS {
  const spin = tabs.filter((tab) => tab.name === 'spin');
  const rest = tabs.filter((tab) => tab.name !== 'spin');
  const middle = Math.ceil(rest.length / 2);
  return [...rest.slice(0, middle), ...spin, ...rest.slice(middle)];
}

export function KeshtTabBar({ keshtId }: { keshtId: string }) {
  const { t } = useApp();

  return (
    <nav className="tabbar-wrap" aria-label={t('keshtNav')}>
      <div className="tabbar">
        {centered(TABS).map((tab) => {
          const center = tab.name === 'spin';
          const target = tab.path ? `/k/${keshtId}/${tab.path}` : `/k/${keshtId}`;
          return (
            <NavLink
              key={tab.name}
              to={target}
              end={tab.end}
              className={({ isActive }) => `tab${center ? ' center' : ''}${isActive ? ' active' : ''}`}
            >
              <Glyph name={tab.name} size={center ? 26 : 20} />
              <span className="tab-label">{t(tab.label)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
