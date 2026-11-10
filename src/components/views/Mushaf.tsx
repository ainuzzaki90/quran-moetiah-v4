'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SURAH_PAGES } from '@/lib/surah-pages';
import { api } from '@/lib/api-client';
import type { MushafTarget } from '@/lib/mushaf-target';
import type { User } from '../AppShell';

type Seg = [number, number, string]; // [surah, ayat, teks]
type Item = ['h', number] | ['b'] | ['l', number, Seg[]];
type MushafData = { basmalah: string; surahNameAr: string[]; juzStart: number[]; pages: Item[][] };

let dataPromise: Promise<MushafData> | null = null;
function loadData(): Promise<MushafData> {
  if (!dataPromise) {
    dataPromise = fetch('/mushaf/mushaf-data.json')
      .then((r) => { if (!r.ok) throw new Error('Data mushaf tidak ditemukan'); return r.json(); })
      .catch((e) => { dataPromise = null; throw e; });
  }
  return dataPromise;
}

const NAT99 = 2037.5;                 // lebar alami (px pada font 100px) persentil-99 seluruh baris mushaf
const ZOOMS = [1, 1.3, 1.6, 2];
const LS = (k: string) => `mq_mushaf_${k}`;
const lsGet = (k: string) => { try { return localStorage.getItem(LS(k)); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(LS(k), v); } catch { /* abaikan */ } };
const key = (s: number, a: number) => s * 1000 + a;

type Range = { lo: number; hi: number };

export type MushafPick = { surahMulai: number; ayatMulai: number; surahSelesai: number; ayatSelesai: number };

export default function MushafView({ user, target, embedded, onPick, pickHint }: {
  user: User; target?: MushafTarget | null;
  /** Dipakai di halaman Setoran: tanpa judul/tab, ayat bisa diketuk untuk mengisi form. */
  embedded?: boolean; onPick?: (r: MushafPick) => void; pickHint?: string;
}) {
  const [data, setData] = useState<MushafData | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'baca' | 'peta'>('baca');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoomIdx, setZoomIdx] = useState(0);
  const [range, setRange] = useState<Range | null>(null);
  const [rangeLabel, setRangeLabel] = useState('');
  const [sel, setSel] = useState<{ s: number; a: number } | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [boxBase, setBoxBase] = useState(360);
  const [lineFs, setLineFs] = useState<number[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [petaSantri, setPetaSantri] = useState<string>('');
  const [pickStart, setPickStart] = useState<number | null>(null);
  const pickedRef = useRef('');

  // ---- muat data + font ----
  useEffect(() => {
    loadData().then(setData).catch((e) => setError(e.message));
    try { document.fonts.load('20px "KFGQPC Hafs"').then(() => setFontReady(true)).catch(() => setFontReady(true)); } catch { setFontReady(true); }
    const z = Number(lsGet('zoom'));
    if (z >= 0 && z < ZOOMS.length && Number.isInteger(z)) setZoomIdx(z);
  }, []);

  // ---- indeks ayat -> halaman ----
  const ayahPage = useMemo(() => {
    const m = new Map<number, number>();
    if (!data) return m;
    data.pages.forEach((items, i) => items.forEach((it) => {
      if (it[0] === 'l') it[2].forEach(([s, a]) => { if (s && !m.has(key(s, a))) m.set(key(s, a), i + 1); });
    }));
    return m;
  }, [data]);

  const goPage = useCallback((p: number) => {
    const n = Math.min(604, Math.max(1, Math.round(p) || 1));
    setPage(n); setPageInput(String(n)); setSel(null);
    lsSet(`last_${user.id}`, String(n));
  }, [user.id]);

  // ---- halaman awal: target dari layar lain, atau terakhir dibaca ----
  const targetKey = target ? JSON.stringify(target) : '';
  const awalDone = useRef('');
  useEffect(() => {
    if (!data || awalDone.current === targetKey + '|' + data.pages.length) return;
    awalDone.current = targetKey + '|' + data.pages.length;
    if (target?.tab === 'peta') {
      setTab('peta');
      if (target.santriId) setPetaSantri(String(target.santriId));
      return;
    }
    if (target?.surah && target.ayat) {
      const s2 = target.surahSelesai || target.surah, a2 = target.ayatSelesai || target.ayat;
      const lo = key(target.surah, target.ayat), hi = key(s2, a2);
      setTab('baca');
      if (target.soroti === false) {
        setRange(null); setRangeLabel(''); setPickStart(null); pickedRef.current = '';
        goPage(ayahPage.get(lo) || 1);
        return;
      }
      setRange({ lo: Math.min(lo, hi), hi: Math.max(lo, hi) });
      if (pickedRef.current === `${Math.min(lo, hi)}-${Math.max(lo, hi)}`) return; // berasal dari ketukan sendiri: jangan loncat halaman
      setPickStart(null);
      const nama = SURAH_PAGES[target.surah - 1]?.[1] || '';
      setRangeLabel(target.label || `${nama} : ${target.ayat}${(s2 !== target.surah || a2 !== target.ayat) ? `–${s2 !== target.surah ? (SURAH_PAGES[s2 - 1]?.[1] + ' : ') : ''}${a2}` : ''}`);
      goPage(ayahPage.get(key(target.surah, target.ayat)) || 1);
      return;
    }
    const last = Number(lsGet(`last_${user.id}`));
    if (last >= 1 && last <= 604) goPage(last);
  }, [data, targetKey, ayahPage, goPage, target, user.id]);

  // ---- lebar kotak mengikuti lebar layar ----
  useEffect(() => {
    const el = wrapRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxBase(Math.max(280, Math.min(el.clientWidth, 720))));
    ro.observe(el); setBoxBase(Math.max(280, Math.min(el.clientWidth, 720)));
    return () => ro.disconnect();
  }, [tab, data]);

  const boxW = Math.round(boxBase * ZOOMS[zoomIdx]);
  const small = page <= 2;
  const innerW = boxW - 32;                    // padding 14 + border 2 per sisi
  const fs = (innerW / NAT99) * 100;           // ukuran huruf sama untuk semua halaman
  const items = data ? data.pages[page - 1] : [];

  // ---- baris terlalu lebar diperkecil sedikit agar tidak terpotong ----
  useLayoutEffect(() => {
    if (!data || !fontReady || !probeRef.current) return;
    const probe = probeRef.current;
    const avail = small ? innerW * 0.82 : innerW;
    const out: number[] = [];
    items.forEach((it) => {
      if (it[0] !== 'l') { out.push(fs); return; }
      probe.textContent = it[2].map((s) => s[2]).join(' ');
      const w100 = probe.getBoundingClientRect().width;
      const natural = (w100 / 100) * fs;
      out.push(natural > avail ? (fs * avail) / natural * 0.995 : fs);
    });
    setLineFs(out);
  }, [data, fontReady, page, boxW, small, items, fs, innerW]);

  // ---- tombol panah keyboard (kiri = halaman berikutnya, seperti membalik kitab Arab) ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tab !== 'baca' || tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'ArrowLeft') goPage(page + 1);
      if (e.key === 'ArrowRight') goPage(page - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, page, goPage]);

  function ubahZoom(d: number) {
    const n = Math.min(ZOOMS.length - 1, Math.max(0, zoomIdx + d));
    setZoomIdx(n); lsSet('zoom', String(n));
  }
  function klikAyat(sn: number, an: number, isSel: boolean) {
    if (!onPick) { setSel(isSel ? null : { s: sn, a: an }); return; }
    const k = key(sn, an);
    if (pickStart === null) {
      setPickStart(k);
      pickedRef.current = `${k}-${k}`;
      setRange({ lo: k, hi: k });
      setRangeLabel(`${SURAH_PAGES[sn - 1]?.[1]} : ${an}`);
      onPick({ surahMulai: sn, ayatMulai: an, surahSelesai: sn, ayatSelesai: an });
    } else {
      const lo = Math.min(pickStart, k), hi = Math.max(pickStart, k);
      const s1 = Math.floor(lo / 1000), a1 = lo % 1000, s2 = Math.floor(hi / 1000), a2 = hi % 1000;
      pickedRef.current = `${lo}-${hi}`;
      setPickStart(null);
      setRange({ lo, hi });
      setRangeLabel(`${SURAH_PAGES[s1 - 1]?.[1]} : ${a1}${s2 !== s1 || a2 !== a1 ? `–${s2 !== s1 ? SURAH_PAGES[s2 - 1]?.[1] + ' : ' : ''}${a2}` : ''}`);
      onPick({ surahMulai: s1, ayatMulai: a1, surahSelesai: s2, ayatSelesai: a2 });
    }
  }
  const inRange = (s: number, a: number) => !!range && key(s, a) >= range.lo && key(s, a) <= range.hi;
  const surahHalaman = SURAH_PAGES[0] ? SURAH_PAGES : [];
  const juzNow = data ? data.juzStart.filter((p) => p <= page).length : 1;
  const lastRangePage = range ? (ayahPage.get(range.hi) || 0) : 0;
  const firstRangePage = range ? (ayahPage.get(range.lo) || 0) : 0;
  const lineH = fs * 1.95;

  return (
    <div>
      {!embedded && <h1 className="tf-title">Mushaf Digital</h1>}
      <div className="tf-panel">
        <div className="tf-panel-body">
          {embedded && onPick && (
            <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 10 }}>
              ✍️ {pickHint || 'Ketuk ayat untuk mengisi form.'}
              {pickStart !== null && <> <b>Ayat awal dipilih — ketuk ayat akhir</b> (atau ketuk ayat yang sama lagi jika hanya satu ayat).</>}
            </div>
          )}
          {!embedded && <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className={tab === 'baca' ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} onClick={() => setTab('baca')}>📖 Baca Mushaf</button>
            <button className={tab === 'peta' ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} onClick={() => setTab('peta')}>🗺️ Peta Hafalan</button>
          </div>}
          {error && <div className="tf-error">{error}</div>}
          {!data && !error && <div className="tf-empty">Memuat mushaf...</div>}

          {data && tab === 'baca' && (
            <>
              <div className="tf-mushaf-toolbar">
                <select value="" onChange={(e) => e.target.value && goPage(Number(e.target.value))}>
                  <option value="" disabled>-- Lompat ke surah --</option>
                  {surahHalaman.map((s) => <option key={s[0]} value={s[2]}>{s[0]}. {s[1]}</option>)}
                </select>
                <select value="" onChange={(e) => e.target.value && goPage(Number(e.target.value))}>
                  <option value="" disabled>Juz {juzNow} — lompat ke juz</option>
                  {data.juzStart.map((p, i) => <option key={i} value={p}>Juz {i + 1} (hal. {p})</option>)}
                </select>
              </div>
              <div className="tf-mushaf-toolbar">
                <button className="tf-btn-sm" onClick={() => goPage(page - 1)} disabled={page <= 1}>‹ Sebelumnya</button>
                <span>
                  Hal. <input type="number" min={1} max={604} value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goPage(Number(pageInput))} /> / 604
                </span>
                <button className="tf-btn-sm" onClick={() => goPage(Number(pageInput))}>Buka</button>
                <button className="tf-btn-sm" onClick={() => goPage(page + 1)} disabled={page >= 604}>Berikutnya ›</button>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="tf-btn-sm" onClick={() => ubahZoom(-1)} disabled={zoomIdx === 0} title="Perkecil">🔍−</button>
                  <button className="tf-btn-sm" onClick={() => ubahZoom(1)} disabled={zoomIdx === ZOOMS.length - 1} title="Perbesar">🔍+ Perbesar</button>
                </span>
              </div>

              {range && (
                <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>🟨 {embedded ? 'Terpilih' : 'Setoran'}: <b>{rangeLabel}</b>{firstRangePage && lastRangePage && firstRangePage !== lastRangePage ? ` · hal. ${firstRangePage}–${lastRangePage}` : firstRangePage ? ` · hal. ${firstRangePage}` : ''}</span>
                  {firstRangePage > 0 && page !== firstRangePage && <button className="tf-btn-sm" onClick={() => goPage(firstRangePage)}>Ke awal rentang</button>}
                  {lastRangePage > page && <button className="tf-btn-sm" onClick={() => goPage(page + 1)}>Rentang berlanjut ›</button>}
                  <button className="tf-btn-sm" onClick={() => { setRange(null); setRangeLabel(''); setPickStart(null); pickedRef.current = ''; }}>Hapus sorotan</button>
                </div>
              )}
              {sel && (
                <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 10 }}>
                  Ayat dipilih: <b>{SURAH_PAGES[sel.s - 1]?.[1]} : {sel.a}</b> · hal. {ayahPage.get(key(sel.s, sel.a)) || page} · juz {juzNow}
                </div>
              )}

              <div ref={wrapRef} className="mq-scroll">
                <div className="mq-box" style={{ width: boxW }}>
                  {items.map((it, i) => {
                    const f = lineFs[i] || fs;
                    const common = { height: lineH, lineHeight: `${lineH}px` } as const;
                    if (it[0] === 'h') return <div key={i} className="mq-head" style={{ ...common, fontSize: fs * 0.95 }}>سورة {data.surahNameAr[it[1] - 1]}</div>;
                    if (it[0] === 'b') return <div key={i} className="mq-bas" style={{ ...common, fontSize: fs }}>{data.basmalah}</div>;
                    const centered = small || it[1] === 1;
                    return (
                      <div key={i} className={`mq-ln${centered ? ' mq-c' : ''}`} style={{ ...common, fontSize: f, padding: small ? `0 ${boxW * 0.09}px` : 0 }} lang="ar" dir="rtl">
                        {it[2].map((sg, j) => {
                          const hl = inRange(sg[0], sg[1]);
                          const isSel = !!sel && sel.s === sg[0] && sel.a === sg[1];
                          return (
                            <span key={j}>
                              {j > 0 ? ' ' : ''}
                              <span className={`mq-ay${isSel ? ' mq-sel' : hl ? ' mq-hl' : ''}`} onClick={() => sg[0] && klikAyat(sg[0], sg[1], isSel)}>{sg[2]}</span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="mq-foot">Halaman {page} · Juz {juzNow}</div>
                </div>
              </div>
              <span ref={probeRef} className="mq-probe" aria-hidden="true" />
              {zoomIdx > 0 && <div className="tf-mushaf-note">Mode diperbesar: geser ke samping untuk membaca seluruh baris.</div>}
            </>
          )}

          {data && tab === 'peta' && (
            <PetaHafalan user={user} data={data} initialSantri={petaSantri} onOpenPage={(p) => { goPage(p); setRange(null); setTab('baca'); }} />
          )}

          <div className="tf-mushaf-note" style={{ marginTop: 14 }}>
            Tata letak 15 baris mengikuti mushaf Madinah (604 halaman). Pada sebagian kecil halaman, batas halaman bisa berbeda satu atau beberapa ayat dari mushaf cetak tertentu.
            Teks dan font: KFGQPC Uthmanic Hafs melalui dataset <b>quran-text</b> (quran.ws), lisensi CC-BY-4.0.
          </div>
        </div>
      </div>
    </div>
  );
}

function PetaHafalan({ user, data, initialSantri, onOpenPage }: { user: User; data: MushafData; initialSantri: string; onOpenPage: (p: number) => void }) {
  const isSiswa = user.role === 'santri';
  const [list, setList] = useState<any[]>([]);
  const [santriId, setSantriId] = useState(initialSantri);
  const [peta, setPeta] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const muat = useCallback((id: string) => {
    if (!isSiswa && !id) return;
    setLoading(true); setError('');
    api.get(`/mushaf/peta${isSiswa ? '' : `?santri_id=${id}`}`)
      .then(setPeta).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [isSiswa]);

  useEffect(() => {
    if (isSiswa) { muat(''); return; }
    api.get('/santri').then((res) => setList(res.data || [])).catch((e) => setError(e.message));
    if (initialSantri) muat(initialSantri);
  }, [isSiswa, initialSantri, muat]);

  const juz = data.juzStart.map((start, i) => ({ no: i + 1, start, end: (data.juzStart[i + 1] || 605) - 1 }));

  return (
    <div>
      {error && <div className="tf-error">{error}</div>}
      {!isSiswa && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <select value={santriId} onChange={(e) => { setSantriId(e.target.value); muat(e.target.value); }} style={{ flex: '1 1 240px', padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)' }}>
            <option value="">-- pilih siswa --</option>
            {list.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>
      )}
      {loading && <div className="tf-empty">Memuat peta hafalan...</div>}
      {!peta && !loading && !error && <div className="tf-empty">{isSiswa ? 'Memuat...' : 'Pilih siswa untuk melihat peta hafalannya.'}</div>}
      {peta && (
        <>
          <div className="tf-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            <b>{peta.nama}</b> · <span style={{ color: 'var(--forest)', fontWeight: 700 }}>{peta.penuh} halaman hafal penuh</span> · {peta.sebagian} sebagian · {604 - peta.penuh - peta.sebagian} belum
            <br />📖 Hafalan tertinggi: <b>{peta.hafalan_tertinggi_label}</b>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12.5, marginBottom: 8, flexWrap: 'wrap' }} aria-hidden="true">
            <span><span className="mq-cell s2" style={{ display: 'inline-block', width: 16, height: 14, verticalAlign: 'middle' }} /> Hafal penuh</span>
            <span><span className="mq-cell s1" style={{ display: 'inline-block', width: 16, height: 14, verticalAlign: 'middle' }} /> Sebagian</span>
            <span><span className="mq-cell" style={{ display: 'inline-block', width: 16, height: 14, verticalAlign: 'middle' }} /> Belum</span>
          </div>
          {juz.map((j) => (
            <div key={j.no} className="mq-peta-row">
              <span className="mq-peta-juz">Juz {j.no}</span>
              {Array.from({ length: j.end - j.start + 1 }, (_, k) => j.start + k).map((p) => {
                const st = peta.halaman[p - 1];
                return <button key={p} className={`mq-cell s${st}`} title={`Halaman ${p}: ${st === 2 ? 'hafal penuh' : st === 1 ? 'sebagian' : 'belum'}`} onClick={() => onOpenPage(p)}>{p}</button>;
              })}
            </div>
          ))}
          <div className="tf-mushaf-note">Hafalan dihitung dari setoran Hafalan Baru (nilai ≥ 75) dan hafalan awal, sama dengan perhitungan poin prestasi. Klik kotak halaman untuk membukanya di mushaf.</div>
        </>
      )}
    </div>
  );
}
