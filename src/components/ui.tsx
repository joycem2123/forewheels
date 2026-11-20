import { useEffect, type ReactNode } from 'react';
import type { TierId } from '../data/catalog';
import { useStore, type Tab } from '../state/store';

export const Icon = {
  home: <path d="M4 11l8-6 8 6v9H4z" />,
  bookings: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  passes: <><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18M7 14h4" /></>,
  me: <><circle cx="12" cy="9" r="3.5" /><path d="M5 20c1.5-4 4-5 7-5s5.5 1 7 5" /></>,
};

export function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function Logo() {
  return (
    <div className="logo">
      <span className="b3" aria-hidden="true"><i /><i /><i /></span>
      Fore Wheels
    </div>
  );
}

/** Sparkle marks: one for Express, two for Signature, three for Pro. */
export function TierMark({ tier }: { tier: TierId }) {
  const paths: Record<TierId, ReactNode> = {
    express: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    signature: <><path d="M9 3l1.5 4.5L15 9l-4.5 1.5L9 15l-1.5-4.5L3 9l4.5-1.5z" /><path d="M17 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /></>,
    pro: <><path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12 6.7 8.3 3 7l3.7-1.3z" /><path d="M17 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /><path d="M9 15l.8 2.2L12 18l-2.2.8L9 21l-.8-2.2L6 18l2.2-.8z" /></>,
  };
  return <span className="shine"><Svg size={26}>{paths[tier]}</Svg></span>;
}

export function Bubbles({ pct, count = 8, small = false }: { pct: number; count?: number; small?: boolean }) {
  const filled = Math.floor(pct * count);
  return (
    <div className={small ? 'minib' : 'bubs'} role="img" aria-label={`${Math.round(pct * 100)}% done`}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i < filled ? 'on' : i === filled && pct < 1 ? 'cur' : ''} />
      ))}
    </div>
  );
}

export function Donut({ value, of }: { value: number; of: number }) {
  const r = 27, c = 2 * Math.PI * r, frac = of ? value / of : 0;
  return (
    <div className="donut" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ac)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      {value}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segc" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function DateTile({ date, accent = false, label }: { date: Date; accent?: boolean; label?: string }) {
  return (
    <div className={'date' + (accent ? ' accent' : '')}>
      {label ?? ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]}
      <b>{date.getDate()}</b>
    </div>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap">
      <button className="dim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

const TAB_LIST: [Tab, string, ReactNode][] = [
  ['home', 'Home', Icon.home],
  ['bookings', 'Bookings', Icon.bookings],
  ['passes', 'Passes', Icon.passes],
  ['me', 'Me', Icon.me],
];

export function TabBar() {
  const { tab, go } = useStore();
  const btn = ([t, l, ic]: (typeof TAB_LIST)[number]) => (
    <button key={t} type="button" className="tabbtn" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
      <Svg>{ic}</Svg>{l}
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      {btn(TAB_LIST[0])}
      {btn(TAB_LIST[1])}
      <button type="button" className={'bookbtn' + (tab === 'book' ? ' on' : '')} onClick={() => go('book')}>+ Book</button>
      {btn(TAB_LIST[2])}
      {btn(TAB_LIST[3])}
    </nav>
  );
}

export function Toast() {
  const { toast } = useStore();
  return <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">{toast}</div>;
}
