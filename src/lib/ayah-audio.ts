'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SURAH_PAGES } from './surah-pages';

// Nomor ayat global (1..6236) <-> (surah, ayat)
const CUM: number[] = [0];
SURAH_PAGES.forEach((s) => CUM.push(CUM[CUM.length - 1] + s[3]));
export const TOTAL_AYAT = CUM[114];
export const gidOf = (s: number, a: number) => CUM[s - 1] + a;
export function fromGid(g: number): [number, number] {
  for (let s = 1; s <= 114; s++) if (g <= CUM[s]) return [s, g - CUM[s - 1]];
  return [114, SURAH_PAGES[113][3]];
}
const pad3 = (n: number) => String(n).padStart(3, '0');

export type Qari = { id: string; nama: string; urls: ((g: number) => string)[] };
const everyAyah = (folder: string) => (g: number) => { const [s, a] = fromGid(g); return `https://everyayah.com/data/${folder}/${pad3(s)}${pad3(a)}.mp3`; };
// Sumber pertama dicoba lebih dulu; jika gagal otomatis pindah ke sumber berikutnya.
export const QARIS: Qari[] = [
  { id: 'alafasy', nama: 'Mishary Alafasy', urls: [everyAyah('Alafasy_128kbps'), (g) => `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${g}.mp3`] },
  { id: 'husary', nama: 'Al-Husary (Muallim, pelan)', urls: [everyAyah('Husary_Muallim_128kbps')] },
];

const LS = (k: string) => `mq_audio_${k}`;
const lsGet = (k: string) => { try { return localStorage.getItem(LS(k)); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(LS(k), v); } catch { /* abaikan */ } };

export type PlayOpts = { from: number; rangeStart?: number; to?: number; ayatRep?: number; rangeRep?: number };

/** Pemutar audio per ayat: ulang ayat, ulang rentang, kecepatan, cadangan sumber. */
export function useAyahAudio(onAyat?: (g: number) => void) {
  const aRef = useRef<HTMLAudioElement | null>(null);
  const preRef = useRef<HTMLAudioElement | null>(null);
  const onAyatRef = useRef(onAyat); onAyatRef.current = onAyat;
  const plan = useRef({ start: 1, end: TOTAL_AYAT, cur: 1, ayatLeft: 1, ayatRep: 1, rangeLeft: 1, srcIdx: 0 });
  const [playing, setPlaying] = useState(false);
  const [curGid, setCurGid] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [qari, setQariState] = useState('alafasy');
  const [speed, setSpeedState] = useState(1);
  const qariRef = useRef('alafasy');
  const speedRef = useRef(1);

  useEffect(() => {
    const q = lsGet('qari'); if (q && QARIS.some((x) => x.id === q)) { setQariState(q); qariRef.current = q; }
    const sp = Number(lsGet('speed')); if ([0.75, 1, 1.25].includes(sp)) { setSpeedState(sp); speedRef.current = sp; }
  }, []);

  const stop = useCallback((keepError = false) => {
    const a = aRef.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    setPlaying(false); setCurGid(null);
    if (!keepError) setError('');
  }, []);

  const load = useCallback((g: number, srcIdx: number) => {
    const a = aRef.current; if (!a) return;
    const q = QARIS.find((x) => x.id === qariRef.current) || QARIS[0];
    const mk = q.urls[srcIdx];
    if (!mk) { setError('Audio tidak dapat dimuat. Periksa koneksi internet.'); stop(true); return; }
    plan.current.cur = g; plan.current.srcIdx = srcIdx;
    setCurGid(g);
    onAyatRef.current?.(g);
    a.src = mk(g);
    a.defaultPlaybackRate = speedRef.current; a.playbackRate = speedRef.current;
    a.play().then(() => { setPlaying(true); setError(''); }).catch((e) => {
      if (e?.name === 'NotAllowedError') { setError('Peramban memblokir pemutaran. Ketuk tombol putar sekali lagi.'); setPlaying(false); }
    });
    try {
      if (g < TOTAL_AYAT && q.urls[srcIdx]) {
        if (!preRef.current) preRef.current = new Audio();
        preRef.current.preload = 'auto'; preRef.current.src = q.urls[srcIdx](g + 1);
      }
      if ('mediaSession' in navigator) {
        const [s, ay] = fromGid(g);
        navigator.mediaSession.metadata = new MediaMetadata({ title: `${SURAH_PAGES[s - 1][1]} : ${ay}`, artist: q.nama, album: 'Moetiah Quran App' });
      }
    } catch { /* abaikan */ }
  }, [stop]);

  const ensure = useCallback(() => {
    if (aRef.current) return aRef.current;
    const a = new Audio(); a.preload = 'auto'; aRef.current = a;
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('play', () => setPlaying(true));
    a.addEventListener('ended', () => {
      const p = plan.current;
      if (p.ayatLeft > 1) { p.ayatLeft--; a.currentTime = 0; a.play().catch(() => {}); return; }
      p.ayatLeft = p.ayatRep;
      let next = p.cur + 1;
      if (next > p.end) {
        if (p.rangeLeft > 1) { p.rangeLeft--; next = p.start; } else { stop(); return; }
      }
      load(next, p.srcIdx); // tetap memakai sumber yang berhasil
    });
    a.addEventListener('error', () => {
      if (!a.getAttribute('src')) return; // src dikosongkan oleh stop()
      const p = plan.current;
      const q = QARIS.find((x) => x.id === qariRef.current) || QARIS[0];
      if (p.srcIdx + 1 < q.urls.length) load(p.cur, p.srcIdx + 1);
      else { setError('Audio tidak dapat dimuat. Periksa koneksi internet, atau coba lagi nanti.'); stop(true); }
    });
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => { a.play().catch(() => {}); });
        navigator.mediaSession.setActionHandler('pause', () => a.pause());
      }
    } catch { /* abaikan */ }
    return a;
  }, [load, stop]);

  const play = useCallback((o: PlayOpts) => {
    ensure();
    const to = Math.min(TOTAL_AYAT, o.to ?? TOTAL_AYAT);
    plan.current = {
      start: o.rangeStart ?? o.from, end: to, cur: o.from, srcIdx: 0,
      ayatRep: o.ayatRep ?? 1, ayatLeft: o.ayatRep ?? 1, rangeLeft: o.rangeRep ?? 1,
    };
    setError('');
    load(o.from, 0);
  }, [ensure, load]);

  const pause = useCallback(() => { aRef.current?.pause(); }, []);
  const resume = useCallback(() => { aRef.current?.play().catch(() => {}); }, []);
  const setQari = useCallback((id: string) => { setQariState(id); qariRef.current = id; lsSet('qari', id); }, []);
  const setSpeed = useCallback((v: number) => {
    setSpeedState(v); speedRef.current = v; lsSet('speed', String(v));
    if (aRef.current) { aRef.current.defaultPlaybackRate = v; aRef.current.playbackRate = v; }
  }, []);

  useEffect(() => () => { const a = aRef.current; if (a) { a.pause(); a.removeAttribute('src'); } }, []);

  return { playing, curGid, error, qari, speed, play, pause, resume, stop, setQari, setSpeed };
}
