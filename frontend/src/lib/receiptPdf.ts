type PdfDocument = InstanceType<(typeof import('jspdf'))['default']>;

/** Page margin, in mm. */
const MARGIN = 10;
/** A4 width in CSS pixels (96 dpi): the receipt is laid out at this width. */
const A4_WIDTH_PX = 794;

/**
 * Renders a receipt's markup to an A4 PDF in the browser. It's an image of
 * the receipt, so Arabic shaping and right-to-left layout come out exactly as
 * displayed. The libraries load only when a PDF is actually needed.
 */
async function renderReceiptPdf(source: HTMLElement): Promise<PdfDocument> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // Render a detached copy at A4 width, outside the dialog's scroll area.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed; top:-20000px; left:0; width:${A4_WIDTH_PX}px; background:#ffffff; pointer-events:none;`;
  wrapper.innerHTML = source.innerHTML;
  // The on-screen "paper" frame (border, shadow, rounded corners) isn't part of the page.
  wrapper.querySelectorAll<HTMLElement>('.receipt-document').forEach((el) => {
    el.style.border = 'none';
    el.style.boxShadow = 'none';
    el.style.borderRadius = '0';
  });
  document.body.appendChild(wrapper);

  try {
    await document.fonts.ready;
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: A4_WIDTH_PX,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const contentW = pdf.internal.pageSize.getWidth() - 2 * MARGIN;
    const contentH = pdf.internal.pageSize.getHeight() - 2 * MARGIN;
    const pxPerMm = canvas.width / contentW;
    const pageHeightPx = Math.floor(contentH * pxPerMm);

    // Slice tall receipts across pages, inside the margins.
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
      pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', MARGIN, MARGIN, contentW, sliceH / pxPerMm);
    }

    return pdf;
  } finally {
    wrapper.remove();
  }
}

/** The receipt as an A4 PDF, base64-encoded (for email attachments). */
export async function receiptToPdfBase64(source: HTMLElement): Promise<string> {
  const pdf = await renderReceiptPdf(source);
  return pdf.output('datauristring').split(',')[1];
}

/** Saves the receipt as an A4 PDF file. */
export async function downloadReceiptPdf(source: HTMLElement, fileName: string): Promise<void> {
  const pdf = await renderReceiptPdf(source);
  pdf.save(`${fileName}.pdf`);
}
