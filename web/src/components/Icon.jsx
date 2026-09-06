// Lucide-style single-path glyphs, stroked to match the design system.
const PATHS = {
  today: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  inbox: 'M21 11.5a8 8 0 0 1-11.7 7.1L3.5 20.5l1.9-5.6A8 8 0 1 1 21 11.5z',
  orders: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9',
  reminders: 'M6 9.5a6 6 0 1 1 12 0c0 4.5 1.8 5.5 1.8 5.5H4.2S6 14 6 9.5M10 19a2 2 0 0 0 4 0',
  customers: 'M4.5 20.5a7.5 7.5 0 0 1 15 0M16.2 8.2a4.2 4.2 0 1 1-8.4 0 4.2 4.2 0 0 1 8.4 0',
  back: 'm15 5-7 7 7 7',
  close: 'M18 6 6 18M6 6l12 12',
  send: 'M4 12h15M13 6l6 6-6 6',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  warning: 'M12 4 21 19.5H3zM12 10v4.2M12 17.2h.01',
  signal: 'M2 12.5a13 13 0 0 1 20 0M6 16a8 8 0 0 1 12 0M12 20h.01',
};

export default function Icon({ name, size = 22, strokeWidth = 1.6, style }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', ...style }} aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
