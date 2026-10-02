/**
 * Renders a receipt's on-screen markup to an A4 PDF in the browser and returns
 * it base64-encoded. It's an image of the receipt, so Arabic shaping and
 * right-to-left layout come out exactly as displayed. The libraries load only
 * when a PDF is actually needed.
 */
export async function receiptToPdfBase64(source: HTMLElement): Promise<string> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // Render a detached copy at A4 width, outside the dialog's scroll area.
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed; top:-20000px; left:0; width:794px; background:#ffffff; pointer-events:none;';
  wrapper.innerHTML = source.innerHTML;
  document.body.appendChild(wrapper);

  try {
    await document.fonts.ready;
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / pdfW;
    const pageHeightPx = Math.floor(pdfH * ratio);

    // Slice tall receipts across pages.
    for (let srcY = 0; srcY < canvas.height; srcY += pageHeightPx) {
      if (srcY > 0) pdf.addPage();
      const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, pdfW, sliceH / ratio);
    }

    return pdf.output('datauristring').split(',')[1];
  } finally {
    wrapper.remove();
  }
}
