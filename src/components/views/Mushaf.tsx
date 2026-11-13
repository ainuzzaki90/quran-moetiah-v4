'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SURAH_PAGES } from '@/lib/surah-pages';
import { api } from '@/lib/api-client';
import type { MushafTarget } from '@/lib/mushaf-target';
import { useAyahAudio, gidOf, fromGid, QARIS, TOTAL_AYAT } from '@/lib/ayah-audio';
import { PAGE_FIRST_AYAH_ID } from '@/lib/mushaf-pages';
import { buildIndex, cari as cariMushaf, type Hasil } from '@/lib/mushaf-search';
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
  const [audioOpen, setAudioOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [navBtn, setNavBtn] = useState(true); // tombol ‹ › melayang (disimpan per perangkat)
  useEffect(() => { if (lsGet('navbtn') === '0') setNavBtn(false); }, []);
  const ubahNavBtn = () => { const v = !navBtn; setNavBtn(v); lsSet('navbtn', v ? '1' : '0'); };
  const [cari, setCari] = useState('');
  const [cariOpen, setCariOpen] = useState(false);
  const [cariLimit, setCariLimit] = useState(30);
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  // halaman terakhir dibaca saat komponen dibuka (sebelum tertimpa lompatan dari layar lain)
  const [lastAtOpen] = useState(() => Number(lsGet(`last_${user.id}`)) || 0);
  const pickedRef = useRef('');
  const [ayatRep, setAyatRep] = useState(1);
  const [rangeRep, setRangeRep] = useState(1);
  const pageRef = useRef(1);
  const ayahPageRef = useRef<Map<number, number>>(new Map());
  const goPageRef = useRef<(p: number) => void>(() => {});
  const audio = useAyahAudio((g) => {
    const [sn, an] = fromGid(g);
    const p = ayahPageRef.current.get(key(sn, an));
    if (p && p !== pageRef.current) goPageRef.current(p);
  });

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

  // pindah halaman oleh pengguna/audio: kembali ke awal halaman mushaf agar tidak "tertinggal" di bawah
  const pindah = useCallback((p: number) => {
    goPage(p);
    requestAnimationFrame(() => {
      const el = wrapRef.current; if (!el) return;
      const dalamPanel = el.closest('.tf-split-mushaf') as HTMLElement | null;
      if (dalamPanel) dalamPanel.scrollTo({ top: 0 });
      else el.scrollIntoView({ block: 'start' });
    });
  }, [goPage]);

  pageRef.current = page; ayahPageRef.current = ayahPage; goPageRef.current = pindah;
  useEffect(() => { if (tab === 'peta') audio.stop(); /* eslint-disable-next-line */ }, [tab]);

  // ---- halaman awal: target dari layar lain, atau terakhir dibaca ----
  const targetKey = target ? JSON.stringify(target) : '';
  const awalDone = useRef('');
  useEffect(() => {
    if (!data || awalDone.current === targetKey + '|' + data.pages.length) return;
    awalDone.current = targetKey + '|' + data.pages.length;
    if (target?.tab === 'peta') {
      audio.stop();
      setTab('peta');
      if (target.santriId) setPetaSantri(String(target.santriId));
      return;
    }
    if (target?.surah && target.ayat) {
      const s2 = target.surahSelesai || target.surah, a2 = target.ayatSelesai || target.ayat;
      const lo = key(target.surah, target.ayat), hi = key(s2, a2);
      setTab('baca');
      if (target.soroti === false) {
        audio.stop();
        setRange(null); setRangeLabel(''); setPickStart(null); pickedRef.current = '';
        goPage(ayahPage.get(lo) || 1);
        return;
      }
      setRange({ lo: Math.min(lo, hi), hi: Math.max(lo, hi) });
      if (pickedRef.current === `${Math.min(lo, hi)}-${Math.max(lo, hi)}`) return; // berasal dari ketukan sendiri: jangan loncat halaman
      audio.stop();
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
      if (e.key === 'ArrowLeft') pindah(page + 1);
      if (e.key === 'ArrowRight') pindah(page - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, page, pindah]);

  function ubahZoom(d: number) {
    const n = Math.min(ZOOMS.length - 1, Math.max(0, zoomIdx + d));
    setZoomIdx(n); lsSet('zoom', String(n));
  }
  function mulaiPutar() {
    const selG = !onPick && sel ? gidOf(sel.s, sel.a) : null;
    const loG = range ? gidOf(Math.floor(range.lo / 1000), range.lo % 1000) : null;
    const hiG = range ? gidOf(Math.floor(range.hi / 1000), range.hi % 1000) : null;
    let from: number, to = TOTAL_AYAT, rangeStart: number | undefined;
    if (selG) {
      from = selG;
      if (loG !== null && hiG !== null && selG >= loG && selG <= hiG) { to = hiG; rangeStart = loG; }
    } else if (loG !== null && hiG !== null) { from = loG; to = hiG; rangeStart = loG; }
    else from = PAGE_FIRST_AYAH_ID[page - 1];
    audio.play({ from, to, rangeStart, ayatRep: embedded ? 1 : ayatRep, rangeRep: embedded || rangeStart === undefined ? 1 : rangeRep });
  }
  function tombolPutar() {
    if (audio.playing) audio.pause();
    else if (audio.curGid !== null) audio.resume();
    else mulaiPutar();
  }
  const [playS, playA] = audio.curGid ? fromGid(audio.curGid) : [0, 0];

  const cariIdx = useMemo(() => (data ? buildIndex(data) : null), [data]);
  const cariRes = useMemo(() => (cariIdx && cari.trim() ? cariMushaf(cariIdx, cari) : null), [cariIdx, cari]);
  function pilihHasil(h: Hasil) {
    pindah(h.page);
    if (h.s && h.a && h.kind !== 'surah' && !onPick) setSel({ s: h.s, a: h.a });
    setCariOpen(false);
  }
  function cariEnter() {
    if (!cariRes || !cariRes.hasil.length) { setCariOpen(true); return; }
    if (cariRes.hasil.length === 1 || cariRes.hasil[0].kind !== 'teks') pilihHasil(cariRes.hasil[0]);
    else setCariOpen(true);
  }
  function onTouchStart(e: React.TouchEvent) { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }; }
  function onTouchEnd(e: React.TouchEvent) {
    const st = touchRef.current; touchRef.current = null;
    if (!st || zoomIdx !== 0) return; // saat diperbesar, geser dipakai untuk menggulir
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (Date.now() - st.t > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    pindah(dx > 0 ? page + 1 : page - 1); // geser ke kanan = halaman berikutnya (seperti membuka mushaf Arab)
  }
  const surahDiHalaman = useMemo(() => {
    if (!data) return [] as number[];
    const out: number[] = [];
    (data.pages[page - 1] || []).forEach((it) => {
      if (it[0] === 'l') it[2].forEach((sg) => { if (sg[0] && !out.includes(sg[0])) out.push(sg[0]); });
    });
    return out;
  }, [data, page]);

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
      <div className="tf-panel mq-panel">
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
              <div className="tf-mushaf-toolbar" style={{ marginBottom: 8 }}>
                <select value="" onChange={(e) => e.target.value && pindah(Number(e.target.value))}>
                  <option value="" disabled>-- Lompat ke surah --</option>
                  {surahHalaman.map((s) => <option key={s[0]} value={s[2]}>{s[0]}. {s[1]}</option>)}
                </select>
                <select value="" onChange={(e) => e.target.value && pindah(Number(e.target.value))}>
                  <option value="" disabled>Juz {juzNow} — lompat ke juz</option>
                  {data.juzStart.map((p, i) => <option key={i} value={p}>Juz {i + 1} (hal. {p})</option>)}
                </select>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="mq-cari" value={cari} placeholder="Cari: 2:255 · baqarah · kata Arab" inputMode="text" autoComplete="off"
                    onChange={(e) => { setCari(e.target.value); setCariOpen(true); setCariLimit(30); }} onFocus={() => cari.trim() && setCariOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter') cariEnter(); if (e.key === 'Escape') setCariOpen(false); }} />
                  <button className="tf-btn-sm" onClick={cariEnter}>Cari</button>
                </span>
              </div>
              {cariOpen && cariRes && (
                <div className="mq-res">
                  <div className="mq-res-head">
                    <span>{cariRes.hasil.length ? (cariRes.hasil[0].kind === 'teks' ? `${cariRes.total} ayat mengandung kata itu` : 'Hasil pencarian') : (cariRes.pesan || 'Tidak ditemukan')}</span>
                    <button className="tf-btn-sm" onClick={() => setCariOpen(false)}>✕ Tutup</button>
                  </div>
                  {cariRes.hasil.slice(0, cariLimit).map((h) => (
                    <button key={h.id} className="mq-res-i" onClick={() => pilihHasil(h)}>
                      <span className="mq-res-t"><b>{h.label}</b>{h.sub ? <small> · {h.sub}</small> : null}</span>
                      {h.arab && <span className="mq-res-ar" lang="ar" dir="rtl">{h.arab.before}<mark>{h.arab.hit}</mark>{h.arab.after}</span>}
                    </button>
                  ))}
                  {cariRes.hasil.length > cariLimit && <button className="tf-btn-sm" style={{ margin: 8 }} onClick={() => setCariLimit(cariLimit + 30)}>Tampilkan lebih banyak ({cariRes.hasil.length - cariLimit} lagi)</button>}
                  {cariRes.total > cariRes.hasil.length && <div className="tf-mushaf-note" style={{ padding: '4px 10px 8px' }}>Menampilkan {cariRes.hasil.length} pertama dari {cariRes.total}. Tambahkan kata agar lebih spesifik.</div>}
                </div>
              )}
              <div className="tf-mushaf-toolbar" style={{ marginBottom: 8 }}>
                <button className="tf-btn-sm" onClick={() => pindah(page - 1)} disabled={page <= 1}>‹ Sebelumnya</button>
                <span>
                  Hal. <input type="number" min={1} max={604} value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pindah(Number(pageInput))} /> / 604
                </span>
                <button className="tf-btn-sm" onClick={() => pindah(Number(pageInput))}>Buka</button>
                <button className="tf-btn-sm" onClick={() => pindah(page + 1)} disabled={page >= 604}>Berikutnya ›</button>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="tf-btn-sm" onClick={() => ubahZoom(-1)} disabled={zoomIdx === 0} title="Perkecil">🔍−</button>
                  <button className="tf-btn-sm" onClick={() => ubahZoom(1)} disabled={zoomIdx === ZOOMS.length - 1} title="Perbesar">🔍+ Perbesar</button>
                </span>
              </div>

              <div className="tf-mushaf-toolbar" style={{ marginBottom: 8 }}>
                <button className="tf-btn-sm tf-btn" style={{ width: 'auto' }} onClick={tombolPutar}>{audio.playing ? '⏸ Jeda' : audio.curGid !== null ? '▶ Lanjut' : '▶ Putar audio'}</button>
                {audio.curGid !== null && <button className="tf-btn-sm" onClick={() => audio.stop()}>⏹ Berhenti</button>}
                {audio.curGid !== null && <span style={{ fontSize: 12.5 }}>🔊 {SURAH_PAGES[playS - 1]?.[1]} : {playA}</span>}
                {!embedded && <button className={audioOpen ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} onClick={() => setAudioOpen(!audioOpen)}>⚙ Audio</button>}
                {!embedded && lastAtOpen > 0 && lastAtOpen !== page && <button className="tf-btn-sm" onClick={() => pindah(lastAtOpen)} title="Kembali ke halaman terakhir dibaca">↩ Terakhir dibaca (hal. {lastAtOpen})</button>}
                <button className={infoOpen ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} style={{ marginLeft: 'auto' }} onClick={() => setInfoOpen(!infoOpen)} title="Petunjuk">ℹ️</button>
              </div>
              {!embedded && audioOpen && (
                <div className="tf-mushaf-toolbar" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12.5 }}>Qari{' '}
                    <select value={audio.qari} onChange={(e) => audio.setQari(e.target.value)}>
                      {QARIS.map((q) => <option key={q.id} value={q.id}>{q.nama}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12.5 }}>Ulang ayat{' '}
                    <select value={ayatRep} onChange={(e) => setAyatRep(Number(e.target.value))}>
                      {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}×</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12.5 }} title={range ? '' : 'Aktif jika ada rentang ayat yang disorot'}>Ulang rentang{' '}
                    <select value={rangeRep} disabled={!range} onChange={(e) => setRangeRep(Number(e.target.value))}>
                      {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}×</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12.5 }}>Kecepatan{' '}
                    <select value={audio.speed} onChange={(e) => audio.setSpeed(Number(e.target.value))}>
                      {[0.75, 1, 1.25].map((n) => <option key={n} value={n}>{n}×</option>)}
                    </select>
                  </label>
                </div>
              )}
              {audio.error && <div className="tf-error" style={{ marginBottom: 8 }}>{audio.error}</div>}
              {infoOpen && (
                <div className="tf-mushaf-note" style={{ marginBottom: 8 }}>
                  Ketuk ayat untuk memilihnya. Audio dimulai dari tombol ▶ (dari ayat terpilih, rentang sorotan, atau awal halaman) dan memerlukan internet.
                  Di HP, geser ke kanan untuk halaman berikutnya dan ke kiri untuk sebelumnya (saat tidak diperbesar). Di laptop bisa memakai tombol panah kiri/kanan.
                  {!embedded && (
                    <div style={{ marginTop: 6 }}>
                      Tombol ‹ › melayang: <button className={navBtn ? 'tf-btn-sm tf-btn' : 'tf-btn-sm'} onClick={ubahNavBtn}>{navBtn ? 'Hidup' : 'Mati'}</button>
                    </div>
                  )}
                </div>
              )}

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

              <div ref={wrapRef} className="mq-scroll" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
                          const isPlay = playS === sg[0] && playA === sg[1];
                          return (
                            <span key={j}>
                              {j > 0 ? ' ' : ''}
                              <span className={`mq-ay${isPlay ? ' mq-play' : isSel ? ' mq-sel' : hl ? ' mq-hl' : ''}`} onClick={() => sg[0] && klikAyat(sg[0], sg[1], isSel)}>{sg[2]}</span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="mq-foot">Halaman {page} · Juz {juzNow}{surahDiHalaman.length ? ` · ${surahDiHalaman.map((n) => SURAH_PAGES[n - 1][1]).join(' — ')}` : ''}</div>
                </div>
              </div>
              <span ref={probeRef} className="mq-probe" aria-hidden="true" />
              {zoomIdx > 0 && <div className="tf-mushaf-note">Mode diperbesar: geser ke samping untuk membaca seluruh baris.</div>}
              {!embedded && navBtn && (
                <>
                  <button className="mq-fab mq-fab-l" onClick={() => pindah(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya" title="Halaman sebelumnya">‹</button>
                  <button className="mq-fab mq-fab-r" onClick={() => pindah(page + 1)} disabled={page >= 604} aria-label="Halaman berikutnya" title="Halaman berikutnya">›</button>
                </>
              )}
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
