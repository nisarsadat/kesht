import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'back'
  | 'chevron-down'
  | 'sun'
  | 'moon'
  | 'globe'
  | 'home'
  | 'users'
  | 'calendar'
  | 'wheel'
  | 'history'
  | 'plus'
  | 'check'
  | 'close'
  | 'arrow-up'
  | 'arrow-down'
  | 'edit'
  | 'trash'
  | 'coins'
  | 'crown'
  | 'gift'
  | 'sparkle'
  | 'info'
  | 'alert'
  | 'phone'
  | 'user'
  | 'trending'
  | 'target'
  | 'drag';

type IconDef = {
  paths?: string[];
  circles?: [number, number, number][];
};

const DEFS: Record<IconName, IconDef> = {
  back: { paths: ['M15 5l-7 7 7 7'] },
  'chevron-down': { paths: ['M5 9l7 7 7-7'] },
  sun: {
    circles: [[12, 12, 4]],
    paths: ['M12 2v2.5', 'M12 19.5V22', 'M2 12h2.5', 'M19.5 12H22', 'M4.9 4.9l1.8 1.8', 'M17.3 17.3l1.8 1.8', 'M19.1 4.9l-1.8 1.8', 'M6.7 17.3l-1.8 1.8'],
  },
  moon: { paths: ['M20.5 13.2A8.6 8.6 0 0110.8 3.5a8.6 8.6 0 109.7 9.7z'] },
  globe: { circles: [[12, 12, 9]], paths: ['M3.2 12h17.6', 'M12 3a15 15 0 010 18', 'M12 3a15 15 0 000 18'] },
  home: { paths: ['M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z'] },
  users: {
    circles: [[9, 8, 3], [17, 9, 2.2]],
    paths: ['M3.5 19c.6-2.6 2.7-4 5.5-4s4.9 1.4 5.5 4', 'M16.2 15c1.8.3 3.2 1.4 3.8 4'],
  },
  calendar: { paths: ['M5 6h14v13H5z', 'M8 4v4M16 4v4M5 10.5h14'] },
  wheel: { circles: [[12, 12, 8.5]], paths: ['M12 3.5a8.5 8.5 0 018.5 8.5H12z', 'M12 12l-4.6 3.8'] },
  history: { circles: [[12, 12, 8.5]], paths: ['M12 7.5V12l3 1.8'] },
  plus: { paths: ['M12 5v14M5 12h14'] },
  check: { paths: ['M4.5 12.5l5 5L19.5 6.5'] },
  close: { paths: ['M6 6l12 12M18 6L6 18'] },
  'arrow-up': { paths: ['M12 19V5', 'M6 11l6-6 6 6'] },
  'arrow-down': { paths: ['M12 5v14', 'M6 13l6 6 6-6'] },
  edit: { paths: ['M4 20h4L18.6 9.4a2.1 2.1 0 00-3-3L5 17v3z', 'M14.6 6.4l3 3'] },
  trash: { paths: ['M4 7h16', 'M9.5 7V4.8h5V7', 'M6.5 7l1 12.2h9L17.5 7', 'M10.3 10.8v5.4M13.7 10.8v5.4'] },
  coins: {
    paths: [
      'M12 3.2c4.2 0 7.6 1.3 7.6 2.9S16.2 9 12 9 4.4 7.7 4.4 6.1 7.8 3.2 12 3.2z',
      'M4.4 6.1v5.6c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9V6.1',
      'M4.4 11.7v5.6c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9v-5.6',
    ],
  },
  crown: { paths: ['M4 17.5L3 7l5.2 3.2L12 4l3.8 6.2L21 7l-1 10.5z', 'M4.4 20.5h15.2'] },
  gift: { paths: ['M4.5 11.5h15v8.8h-15z', 'M3 7.5h18v4H3z', 'M12 7.5v12.8', 'M12 7.5S9.6 3.6 7.6 4.6 9.2 7.5 12 7.5zM12 7.5s2.4-3.9 4.4-2.9-2.4 2.9-4.4 2.9z'] },
  sparkle: { paths: ['M11 3l1.9 5.4L18.5 10l-5.6 1.6L11 17l-1.9-5.4L3.5 10l5.6-1.6z', 'M18 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'] },
  info: { circles: [[12, 12, 9]], paths: ['M12 11v5.5', 'M12 7.6h.01'] },
  alert: { paths: ['M12 4.2l8.8 15.6H3.2z', 'M12 10v4.2', 'M12 17.2h.01'] },
  phone: { paths: ['M6.2 3.2h2.9l1.9 4.8-2.4 1.5a12 12 0 005 5l1.5-2.4 4.8 1.9v2.9a2 2 0 01-2.2 2A16.6 16.6 0 014.2 5.4a2 2 0 012-2.2z'] },
  user: { circles: [[12, 8, 3.6]], paths: ['M5 20c.8-3.5 3.6-5.4 7-5.4s6.2 1.9 7 5.4'] },
  trending: { paths: ['M3.5 17l6-6 3.8 3.8 7.2-7.2', 'M15 7.6h5.5V13'] },
  target: { circles: [[12, 12, 8.5], [12, 12, 4.2], [12, 12, 0.6]] },
  drag: { circles: [[9, 6, 1.2], [15, 6, 1.2], [9, 12, 1.2], [15, 12, 1.2], [9, 18, 1.2], [15, 18, 1.2]] },
};

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 1.8,
  style,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  style?: object;
}) {
  const def = DEFS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {def.circles?.map(([cx, cy, r]) => (
        <Circle key={`c${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />
      ))}
      {def.paths?.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
