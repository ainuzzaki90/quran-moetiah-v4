'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Render satu blok HTML (hasil buildRaporHtml) ke dalam dokumen jsPDF yang
 * sudah ada. Dipakai baik untuk satu siswa (1 file) maupun banyak siswa
 * digabung jadi satu file (dipanggil berkali-kali dengan doc yang sama).
 * Otomatis memecah jadi beberapa halaman A4 kalau kontennya panjang.
 */
async function renderHtmlIntoDoc(doc: jsPDF, html: string, isFirstPageOfFile: boolean) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '794px'; // ~210mm pada 96dpi, cukup tajam untuk html2canvas scale 2x
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    const pageHeightPx = (canvas.width * A4_HEIGHT_MM) / A4_WIDTH_MM;
    let renderedHeight = 0;
    let firstSlice = true;

    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHeightMm = (sliceHeight * A4_WIDTH_MM) / canvas.width;

      if (!(isFirstPageOfFile && firstSlice)) doc.addPage();
      doc.addImage(sliceImgData, 'JPEG', 0, 0, A4_WIDTH_MM, sliceHeightMm);

      renderedHeight += sliceHeight;
      firstSlice = false;
    }
  } finally {
    document.body.removeChild(container);
  }
}

/** Download satu file PDF untuk satu blok HTML (satu rapor siswa). */
export async function downloadPdfSingle(html: string, filename: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await renderHtmlIntoDoc(doc, html, true);
  doc.save(filename);
}

/** Download satu file PDF gabungan dari banyak blok HTML (misal 1 kelas = 1 file, siswa demi siswa). */
export async function downloadPdfBundle(htmls: string[], filename: string, onProgress?: (i: number, total: number) => void) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  for (let i = 0; i < htmls.length; i++) {
    onProgress?.(i + 1, htmls.length);
    await renderHtmlIntoDoc(doc, htmls[i], i === 0);
  }
  doc.save(filename);
}
