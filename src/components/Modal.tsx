'use client';

export default function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="tf-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tf-modal">{children}</div>
    </div>
  );
}
