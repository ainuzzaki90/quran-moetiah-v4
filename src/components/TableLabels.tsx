'use client';
import { useEffect } from 'react';

/**
 * Tabel yang isinya lebih lebar dari tempatnya otomatis ditampilkan sebagai kartu
 * (tiap sel diberi data-label dari judul kolom), sehingga tidak ada kolom yang terpotong
 * di HP, tablet, maupun saat sidebar terbuka.
 */
export default function TableLabels() {
  useEffect(() => {
    let raf = 0, timer: ReturnType<typeof setTimeout> | null = null;
    const bersih = (t: string) => t.replace(/[\u25B2\u25BC\u2191\u2193\u21C5\u2195]/g, '').replace(/\s+/g, ' ').trim();
    function proses() {
      const tabel = Array.from(document.querySelectorAll<HTMLTableElement>('table.tf-table'));
      // 1) label tiap sel (hanya menulis jika berubah)
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
      // 2) tabel normal dulu, ukur, lalu jadikan kartu jika tidak muat
      tabel.forEach((tb) => tb.classList.remove('tf-cards'));
      const perlu: HTMLTableElement[] = [];
      tabel.forEach((tb) => {
        if (!tb.tHead || !tb.offsetParent) return;
        const wadah = (tb.closest('.tf-table-wrap') as HTMLElement) || tb.parentElement;
        if (wadah && tb.scrollWidth > wadah.clientWidth + 1) perlu.push(tb);
      });
      perlu.forEach((tb) => tb.classList.add('tf-cards'));
    }
    const jadwal = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { raf = requestAnimationFrame(proses); }, 80); };
    const mo = new MutationObserver(jadwal);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', jadwal);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(jadwal) : null;
    const kolom = document.querySelector('.tf-right-col'); if (ro && kolom) ro.observe(kolom);
    jadwal();
    return () => { mo.disconnect(); ro?.disconnect(); window.removeEventListener('resize', jadwal); if (timer) clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
