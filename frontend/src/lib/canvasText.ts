/**
 * Our PDFs are pictures of the page, drawn by html2canvas, which writes text
 * itself instead of letting the browser do it. Two things it gets wrong in
 * Arabic are put right here, on the copy that is about to be drawn:
 *
 * - with any letter-spacing it writes letter by letter, and Arabic letters
 *   written one by one no longer join: the spacing is taken off Arabic text;
 * - it writes word by word in the direction of the paragraph, so a Latin word
 *   carrying a bracket in a right-to-left paragraph comes out as ")test(":
 *   such runs are given their own left-to-right direction.
 */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
/** A stretch of text with no Arabic letter in it. */
const NON_ARABIC_RUN = /[^؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+/g;
/** Characters the bidi algorithm mirrors, with a Latin letter or a digit beside them. */
const NEEDS_OWN_DIRECTION = /[()[\]{}<>«»]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9À-ɏ]/;

/** Prepares an element (already in the document) to be drawn by html2canvas. */
export function prepareForCanvas(root: HTMLElement): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    const parent = node.parentElement;
    if (!parent || !text.trim()) continue;
    const style = getComputedStyle(parent);

    if (ARABIC.test(text) && style.letterSpacing !== 'normal' && parseFloat(style.letterSpacing) !== 0) {
      parent.style.letterSpacing = '0';
    }

    if (style.direction !== 'rtl' || !NEEDS_OWN_DIRECTION.test(text)) continue;
    // Rebuild the text with its bracketed Latin runs set apart.
    const pieces = document.createDocumentFragment();
    let last = 0;
    let changed = false;
    for (const match of text.matchAll(NON_ARABIC_RUN)) {
      const run = match[0];
      const core = run.trim();
      if (!core || !NEEDS_OWN_DIRECTION.test(core) || !LATIN_OR_DIGIT.test(core)) continue;
      const start = (match.index ?? 0) + run.indexOf(core);
      pieces.append(text.slice(last, start));
      const span = document.createElement('span');
      span.dir = 'ltr';
      span.style.unicodeBidi = 'isolate';
      span.textContent = core;
      pieces.append(span);
      last = start + core.length;
      changed = true;
    }
    if (!changed) continue;
    pieces.append(text.slice(last));
    node.replaceWith(pieces);
  }
}
