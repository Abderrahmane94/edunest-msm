function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Prints a document (e.g. a receipt) alone, on an A4 page, from a hidden
 * frame: printing the page itself came out blank (dialogs live in a portal
 * the print styles hide). `fileName` is the frame's title, the default file
 * name when saving as PDF.
 */
export function printDocument(
  node: HTMLElement,
  options: { fileName: string; language: string; direction: 'rtl' | 'ltr' },
): void {
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('');
  const html =
    `<!doctype html><html lang="${options.language}" dir="${options.direction}" ` +
    `class="${document.documentElement.className}"><head><meta charset="utf-8">` +
    `<base href="${document.baseURI}"><title>${escapeHtml(options.fileName)}</title>${styles}` +
    // A4 page. The page margin is 0 so the browser has no room for its own
    // header/footer (URL, date, page number); the white space around the
    // document is padding inside the page instead. The on-screen "paper"
    // frame isn't printed.
    `<style>@page{size:A4;margin:0}body{background:#fff;margin:0;padding:12mm}` +
    `.receipt-document{border:none!important;box-shadow:none!important;border-radius:0!important}` +
    `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>` +
    `<body><div class="receipt-print-root">${node.innerHTML}</div></body></html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });

  // Some browsers name the PDF after the top page's title, so set it too.
  const previousTitle = document.title;
  const cleanup = () => {
    document.title = previousTitle;
    frame.remove();
  };

  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return cleanup();
    win.addEventListener('afterprint', cleanup);
    document.title = options.fileName;
    win.focus();
    win.print();
    // Fallback for browsers that don't fire afterprint on the frame.
    setTimeout(cleanup, 60_000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
