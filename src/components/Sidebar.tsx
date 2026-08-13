'use client';

export default function Sidebar({
  open, onClose, menu, activeView, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  menu: { key: string; label: string }[];
  activeView: string;
  onSelect: (key: string) => void;
}) {
  return (
    <aside className={`tf-sidebar ${open ? 'tf-open' : ''}`} id="tf-sidebar">
      <div className="tf-sidebar-header">
        <div className="tf-brand">
          <img src="/assets/logo.png" alt="Logo" className="tf-logo-sm" /> Moetiah Quran App
        </div>
        <button className="tf-sidebar-close" onClick={onClose} aria-label="Tutup menu">✕</button>
      </div>
      <nav className="tf-menu">
        {menu.map((m) => (
          <button
            key={m.key}
            className={m.key === activeView ? 'active' : ''}
            onClick={() => onSelect(m.key)}
          >
            {m.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
