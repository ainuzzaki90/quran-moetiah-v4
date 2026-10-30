'use client';

import { ASPEK_LIST, SKOR_LEVELS, Bobot, hitungNilaiAspek, calcPredikat } from '@/lib/helpers';

export type SkorState = { makharij: string; tajwid: string; kelancaran: string; ketepatan: string };
export const emptySkor = (): SkorState => ({ makharij: '', tajwid: '', kelancaran: '', ketepatan: '' });

/** Pilihan 4 aspek penilaian + nilai akhir yang dihitung langsung. */
export default function AspekPicker({
  skor, bobot, onChange,
}: { skor: SkorState; bobot: Bobot; onChange: (key: keyof SkorState, value: string) => void }) {
  const nilai = hitungNilaiAspek(skor, bobot);
  return (
    <div>
      <div className="tf-table-wrap">
        <table className="tf-table">
          <thead><tr><th>Aspek</th><th>Bobot</th><th>Penilaian</th></tr></thead>
          <tbody>
            {ASPEK_LIST.map((a) => (
              <tr key={a.key}>
                <td>{a.label}</td>
                <td style={{ textAlign: 'center' }}>{bobot[a.key]}%</td>
                <td>
                  <select value={skor[a.key]} onChange={(e) => onChange(a.key, e.target.value)}>
                    <option value="">-- pilih --</option>
                    {SKOR_LEVELS.map((l) => <option key={l.skor} value={l.skor}>{l.label} ({l.skor})</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tf-empty" style={{ marginTop: 8, textAlign: 'left' }}>
        Nilai akhir: <b style={{ fontSize: 18 }}>{nilai !== null ? nilai : '-'}</b>
        {nilai !== null && <> &nbsp;|&nbsp; Predikat: <b>{calcPredikat(nilai)}</b></>}
        {nilai === null && <> &nbsp;(isi keempat aspek)</>}
      </div>
    </div>
  );
}
