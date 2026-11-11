'use client';
import { useEffect } from 'react';

/**
 * Tampilan tabel di semua halaman:
 *  - Pilihan "Kartu | Tabel" di atas tabel (satu pilihan untuk semua tabel, diingat per perangkat).
 *  - Otomatis (belum memilih): tabel yang tidak muat tampil sebagai kartu, yang muat tetap tabel.
 *  - Mode Kartu: tiap sel diberi data-label + kotak "Urutkan" (memicu klik judul kolom yang sama).
 *  - Mode Tabel: bisa digeser, kolom nama menempel di kiri, bayangan di tepi sebagai petunjuk.
 */
const KEY = 'mq_table_view';
type Pref = 'cards' | 'table' | null;
const getPref = (): Pref => { try { const v = localStorage.getItem(KEY); return v === 'cards' || v === 'table' ? v : null; } catch { return null; } };
const setPref = (v: Pref) => { try { if (v) localStorage.setItem(KEY, v); } catch { /* abaikan */ } };
const bersih = (t: string) => t.replace(/[▲▼↑↓⇅↕]/g, '').replace(/\s+/g, ' ').trim();

export default function TableLabels() {
  useEffect(() => {
    let raf = 0, timer: ReturnType<typeof setTimeout> | null = null;
    const bars = new Map<HTMLElement, HTMLTableElement>();

    function host(tb: HTMLTableElement): HTMLElement {
      return (tb.closest('.tf-table-wrap') as HTMLElement) || (tb.parentElement as HTMLElement);
    }
    // tempat bar dipasang: tepat di atas pembungkus tabel, atau di atas tabel itu sendiri (di dalam isi panel)
    function anchor(tb: HTMLTableElement): HTMLElement {
      return (tb.closest('.tf-table-wrap') as HTMLElement) || tb;
    }

    function proses() {
      const pref = getPref();
      // bersihkan bar yatim
      bars.forEach((tb, bar) => {
        if (!tb.isConnected || bar.nextElementSibling !== anchor(tb)) { bar.remove(); bars.delete(bar); }
      });
      const tabel = Array.from(document.querySelectorAll<HTMLTableElement>('table.tf-table'));

      // 1) label tiap sel
      tabel.forEach((tb) => {
        const hr = tb.tHead?.rows[tb.tHead.rows.length - 1];
        if (!hr) return;
        const labels = Array.from(hr.cells).map((c) => bersih(c.textContent || ''));
        Array.from(tb.tBodies).forEach((body) => Array.from(body.rows).forEach((tr) => {
          let i = 0;
          Array.from(tr.cells).forEach((td) => {
            const l = td.colSpan > 1 ? '' : (labels[i] ?? '');
            if (td.getAttribute('data-label') !== l) td.setAttribute('data-label', l);
            i += td.colSpan || 1;
          });
        }));
      });

      // 2) reset ke tabel normal
      tabel.forEach((tb) => {
        tb.classList.remove('tf-cards', 'tf-scroll');
        tb.querySelectorAll('.tf-sticky').forEach((c) => { c.classList.remove('tf-sticky'); (c as HTMLElement).style.left = ''; });
        host(tb)?.classList.remove('tf-shadowscroll');
      });

      // 3) tentukan mode tiap tabel
      const mode = new Map<HTMLTableElement, 'cards' | 'table' | 'auto'>();
      tabel.forEach((tb) => {
        if (!tb.tHead || !tb.offsetParent) return;
        const kolom = tb.tHead.rows[tb.tHead.rows.length - 1]?.cells.length || 0;
        const bersarang = !!tb.closest('td');
        const bisaPilih = kolom >= 4 && !bersarang;
        if (bisaPilih && pref === 'cards') { mode.set(tb, 'cards'); return; }
        if (bisaPilih && pref === 'table') { mode.set(tb, 'table'); return; }
        const wadah = host(tb);
        mode.set(tb, 'auto');
        if (wadah && tb.scrollWidth > wadah.clientWidth + 1) mode.set(tb, 'cards');
      });
      mode.forEach((m, tb) => { if (m === 'cards') tb.classList.add('tf-cards'); });
      mode.forEach((m, tb) => {
        if (m !== 'table') return;
        tb.classList.add('tf-scroll');
        const h = host(tb); h.classList.add('tf-shadowscroll');
        const ths = Array.from(tb.tHead!.rows[tb.tHead!.rows.length - 1].cells);
        let idx = ths.findIndex((t) => /^nama/i.test(bersih(t.textContent || '')));
        if (idx < 0) idx = 0;
        if (idx <= 1) {
          let left = 0;
          for (let c = 0; c <= idx; c++) {
            const w = ths[c].offsetWidth;
            tb.querySelectorAll<HTMLElement>(`tr > :nth-child(${c + 1})`).forEach((cell) => {
              if (cell.tagName === 'TD' && (cell as HTMLTableCellElement).colSpan > 1) return;
              cell.classList.add('tf-sticky'); cell.style.left = `${left}px`;
            });
            left += w;
          }
        }
      });

      // 4) bar pilihan tampilan + urutkan
      tabel.forEach((tb) => {
        const kolom = tb.tHead?.rows[tb.tHead.rows.length - 1]?.cells.length || 0;
        const h = host(tb);
        let bar = Array.from(bars.entries()).find(([, t]) => t === tb)?.[0];
        const perlu = kolom >= 4 && !tb.closest('td') && !!tb.offsetParent && !!h;
        if (!perlu) { if (bar) { bar.remove(); bars.delete(bar); } return; }
        const aktif = tb.classList.contains('tf-cards') ? 'cards' : 'table';
        const ths = Array.from(tb.tHead!.rows[tb.tHead!.rows.length - 1].cells);
        const sortable = ths.map((t, i) => ({ t, i })).filter((x) => x.t.classList.contains('tf-th-sort'));
        const aktifSort = sortable.find((x) => x.t.querySelector('.tf-sort-active'));
        const arah = aktifSort ? (aktifSort.t.querySelector('.tf-sort-active')?.textContent?.includes('↓') ? '↓' : '↑') : '';
        const sig = [aktif, pref ?? '', sortable.map((x) => bersih(x.t.textContent || '')).join('|'), aktifSort?.i ?? '', arah].join('#');
        if (!bar) {
          bar = document.createElement('div'); bar.className = 'tf-viewbar';
          const a = anchor(tb); a.parentElement!.insertBefore(bar, a);
          bars.set(bar, tb);
        }
        if (bar.dataset.sig === sig) return;
        bar.dataset.sig = sig;
        bar.textContent = '';
        const lbl = document.createElement('span'); lbl.textContent = 'Tampilan:'; bar.appendChild(lbl);
        const mk = (txt: string, v: 'cards' | 'table') => {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
          b.className = aktif === v ? 'tf-btn-sm tf-btn' : 'tf-btn-sm';
          b.onclick = () => { setPref(v); proses(); };
          bar!.appendChild(b);
        };
        mk('☰ Kartu', 'cards'); mk('▦ Tabel', 'table');
        if (aktif === 'cards' && sortable.length) {
          const sel = document.createElement('select');
          const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Urutkan…'; sel.appendChild(o0);
          sortable.forEach((x) => { const o = document.createElement('option'); o.value = String(x.i); o.textContent = bersih(x.t.textContent || ''); sel.appendChild(o); });
          sel.value = aktifSort ? String(aktifSort.i) : '';
          sel.onchange = () => {
            if (sel.value === '') return;
            const cur = Array.from(tb.tHead!.rows[tb.tHead!.rows.length - 1].cells)[Number(sel.value)] as HTMLElement | undefined;
            cur?.click();
          };
          bar.appendChild(sel);
          if (aktifSort) {
            const d = document.createElement('button'); d.type = 'button'; d.className = 'tf-btn-sm';
            d.textContent = arah === '↓' ? '↓ Z–A / besar' : '↑ A–Z / kecil';
            d.title = 'Balik arah urutan';
            d.onclick = () => { (Array.from(tb.tHead!.rows[tb.tHead!.rows.length - 1].cells)[aktifSort.i] as HTMLElement | undefined)?.click(); };
            bar.appendChild(d);
          }
        }
      });
    }

    const jadwal = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { raf = requestAnimationFrame(proses); }, 80); };
    const mo = new MutationObserver(jadwal);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', jadwal);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(jadwal) : null;
    const kolom = document.querySelector('.tf-right-col'); if (ro && kolom) ro.observe(kolom);
    jadwal();
    return () => {
      mo.disconnect(); ro?.disconnect(); window.removeEventListener('resize', jadwal);
      if (timer) clearTimeout(timer); cancelAnimationFrame(raf);
      bars.forEach((_, bar) => bar.remove()); bars.clear();
    };
  }, []);
  return null;
}
