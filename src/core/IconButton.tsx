const paths = {
  edit: "m4 16-1 5 5-1L20 8l-4-4L4 16Zm9-9 4 4",
  delete: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  close: "m6 6 12 12M18 6 6 18",
};
export function IconButton({ icon, label, onClick, blocked = false }: {
  icon: keyof typeof paths; label: string; onClick: () => void; blocked?: boolean;
}) {
  return <button type="button" className="icon-btn" aria-disabled={blocked || undefined} aria-label={label}
    onClick={e => { if (!blocked) { e.currentTarget.focus(); onClick(); } }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[icon]} /></svg>
    <span className="tooltip" aria-hidden="true">{label}</span>
  </button>;
}
