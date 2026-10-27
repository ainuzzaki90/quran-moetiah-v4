'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export type Halaqah = {
  id: number; nama: string; jam_mulai: string | null; jam_selesai: string | null;
  urutan: number; masuk_rapor: boolean; aktif: boolean;
};

/** Memuat daftar halaqah (aktif secara default). */
export function useHalaqah(includeInactive = false) {
  const [list, setList] = useState<Halaqah[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api.get('/halaqah')
      .then((r) => setList((r.data as Halaqah[]).filter((h) => includeInactive || h.aktif)))
      .catch(() => setList([]))
      .finally(() => setLoaded(true));
  }, [includeInactive]);
  return { list, loaded };
}

export function halaqahLabel(h: Halaqah) {
  return h.jam_mulai ? `${h.nama} (${h.jam_mulai}${h.jam_selesai ? '–' + h.jam_selesai : ''})` : h.nama;
}

/**
 * Pilihan halaqah. value '' / 'semua' = semua halaqah (jika allowAll).
 * Setelah daftar termuat, nilai kosong otomatis diisi halaqah pertama (jika !allowAll)
 * atau halaqah rapor utama (jika defaultRapor).
 */
export default function HalaqahSelect({
  list, value, onChange, allowAll = false, label = 'Halaqah',
}: {
  list: Halaqah[]; value: string; onChange: (v: string) => void; allowAll?: boolean; label?: string;
}) {
  useEffect(() => {
    if (!allowAll && !value && list.length) onChange(String(list[0].id));
  }, [list, value, allowAll]);
  return (
    <div className="tf-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="semua">Semua Halaqah</option>}
        {list.map((h) => <option key={h.id} value={h.id}>{halaqahLabel(h)}</option>)}
      </select>
    </div>
  );
}
