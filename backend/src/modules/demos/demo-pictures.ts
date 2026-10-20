/**
 * Pictures for a demonstration school, drawn here (no real child, no stock
 * photo): a cartoon portrait for each child, and pictures of the day's
 * activity (paint, play dough, a book, stickers, blocks) with no one in them.
 * SVG: a few hundred bytes each, sharp at any size.
 */

type Pick = <T>(list: readonly T[]) => T;

const SKIN = ['#F8D9BE', '#F1C6A0', '#E4AE84', '#CF9468', '#B97A50'] as const;
const HAIR = ['#2E1F1A', '#4A2E20', '#6B4226', '#1F1A17', '#8A5A33'] as const;
const BACKGROUND = ['#FDE2E4', '#E2F0EA', '#DCEBFB', '#FFF1C9', '#ECE3FB', '#D7F2E9'] as const;
const SHIRT = ['#F28C8C', '#7FB3E8', '#F7C35F', '#8FD3B6', '#B39DDB', '#F4A261'] as const;
const BRIGHT = ['#EF6F6C', '#F7B32B', '#4FB0C6', '#6BCB77', '#9B7EDE', '#F78FB3'] as const;

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

/** A smiling child, a girl or a boy, in colours picked for this child. */
export function portrait(girl: boolean, pick: Pick): string {
  const skin = pick(SKIN);
  const hair = pick(HAIR);
  const shirt = pick(SHIRT);
  const style = pick([0, 1, 2] as const);
  const behind = girl
    ? style === 0
      ? `<circle cx="46" cy="96" r="18" fill="${hair}"/><circle cx="154" cy="96" r="18" fill="${hair}"/>` // pigtails
      : `<path d="M52 90 Q48 150 64 160 L136 160 Q152 150 148 90 Z" fill="${hair}"/>` // long hair
    : '';
  const top = girl
    ? `<path d="M54 92 Q56 40 100 40 Q144 40 146 92 Q130 66 100 64 Q70 66 54 92 Z" fill="${hair}"/>`
    : style === 2
      ? `<path d="M56 86 Q58 42 100 42 Q142 42 144 86 Q136 60 116 58 Q120 70 106 70 Q100 58 84 62 Q70 66 56 86 Z" fill="${hair}"/>` // tuft
      : `<path d="M56 84 Q58 42 100 42 Q142 42 144 84 Q128 62 100 62 Q72 62 56 84 Z" fill="${hair}"/>`;
  const bow = girl && style !== 1 ? `<path d="M128 50 l12 -8 v16 z M128 50 l-12 -8 v16 z" fill="${pick(BRIGHT)}"/>` : '';
  return svg(
    200,
    200,
    `<rect width="200" height="200" fill="${pick(BACKGROUND)}"/>` +
      behind +
      `<path d="M40 200 Q44 150 100 146 Q156 150 160 200 Z" fill="${shirt}"/>` +
      `<rect x="88" y="128" width="24" height="22" rx="8" fill="${skin}"/>` +
      `<circle cx="100" cy="96" r="44" fill="${skin}"/>` +
      `<circle cx="56" cy="100" r="8" fill="${skin}"/><circle cx="144" cy="100" r="8" fill="${skin}"/>` +
      top +
      bow +
      `<ellipse cx="84" cy="100" rx="5" ry="6" fill="#2B2B2B"/><ellipse cx="116" cy="100" rx="5" ry="6" fill="#2B2B2B"/>` +
      `<circle cx="86" cy="98" r="1.6" fill="#fff"/><circle cx="118" cy="98" r="1.6" fill="#fff"/>` +
      `<circle cx="74" cy="114" r="7" fill="#F28C8C" opacity=".35"/><circle cx="126" cy="114" r="7" fill="#F28C8C" opacity=".35"/>` +
      `<path d="M88 118 Q100 130 112 118" stroke="#8C3B2E" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  );
}

/**
 * The day's activity, in the order of the demonstration's activity texts:
 * finger painting, play dough, a story and colouring, stickers, building blocks.
 */
export function activityPicture(kind: number, pick: Pick): string {
  const c = () => pick(BRIGHT);
  const table = `<rect width="400" height="300" fill="#F3E3C7"/><rect x="40" y="30" width="320" height="240" rx="10" fill="#FFFDF8"/>`;
  switch (kind % 5) {
    case 0: // finger painting: blobs and little hands
      return svg(400, 300, table +
        [70, 150, 230, 300].map((x, i) => `<circle cx="${x + 20}" cy="${90 + (i % 2) * 90}" r="${30 + (i % 3) * 8}" fill="${c()}" opacity=".85"/>`).join('') +
        [[120, 200], [260, 110]].map(([x, y]) => {
          const f = c();
          return `<ellipse cx="${x}" cy="${y}" rx="18" ry="22" fill="${f}"/>` + [-16, -8, 0, 8, 16].map((dx, i) => `<ellipse cx="${x + dx}" cy="${y - 26 - (i === 2 ? 4 : 0)}" rx="5" ry="10" fill="${f}"/>`).join('');
        }).join(''));
    case 1: // play dough: balls and snakes
      return svg(400, 300, `<rect width="400" height="300" fill="#F3E3C7"/>` +
        [[90, 120, 34], [180, 90, 26], [290, 130, 38], [140, 210, 30], [260, 220, 24]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c()}"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 4}" fill="#fff" opacity=".35"/>`).join('') +
        `<path d="M60 260 Q110 230 160 260 T260 260" stroke="${c()}" stroke-width="18" fill="none" stroke-linecap="round"/>`);
    case 2: // a story and colouring: an open book and crayons
      return svg(400, 300, `<rect width="400" height="300" fill="#E7F0FA"/>` +
        `<path d="M60 70 Q130 50 200 80 L200 240 Q130 210 60 230 Z" fill="#fff" stroke="#C9D6E3" stroke-width="3"/>` +
        `<path d="M340 70 Q270 50 200 80 L200 240 Q270 210 340 230 Z" fill="#fff" stroke="#C9D6E3" stroke-width="3"/>` +
        `<circle cx="120" cy="130" r="26" fill="${c()}"/><path d="M90 190 L150 190 L120 150 Z" fill="${c()}"/>` +
        `<rect x="240" y="110" width="70" height="50" rx="6" fill="${c()}"/><circle cx="275" cy="190" r="16" fill="${c()}"/>` +
        [0, 1, 2, 3].map((i) => `<g transform="translate(${90 + i * 60} 262) rotate(-8)"><rect width="44" height="12" rx="3" fill="${c()}"/><path d="M44 0 L56 6 L44 12 Z" fill="#E9D9B8"/></g>`).join(''));
    case 3: // stickers: stars and hearts
      return svg(400, 300, table +
        [[90, 80], [200, 120], [310, 80], [130, 200], [270, 200], [200, 240]].map(([x, y], i) =>
          i % 2
            ? `<path d="M${x} ${y + 18} C${x - 34} ${y - 6} ${x - 14} ${y - 30} ${x} ${y - 12} C${x + 14} ${y - 30} ${x + 34} ${y - 6} ${x} ${y + 18} Z" fill="${c()}"/>`
            : `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => { const a = (Math.PI / 5) * k - Math.PI / 2; const r = k % 2 ? 12 : 28; return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(' ')}" fill="${c()}"/>`,
        ).join(''));
    default: // building blocks: a little tower and a house
      return svg(400, 300, `<rect width="400" height="300" fill="#E9F5EC"/><rect y="250" width="400" height="50" fill="#CDE6D3"/>` +
        [0, 1, 2, 3].map((i) => `<rect x="${80 + (i % 2) * 6}" y="${200 - i * 46}" width="70" height="46" rx="6" fill="${c()}" stroke="#fff" stroke-width="3"/>`).join('') +
        `<rect x="220" y="160" width="110" height="90" rx="6" fill="${c()}" stroke="#fff" stroke-width="3"/>` +
        `<polygon points="210,162 275,100 340,162" fill="${c()}" stroke="#fff" stroke-width="3"/>` +
        `<rect x="262" y="200" width="26" height="50" rx="4" fill="#fff" opacity=".8"/>`);
  }
}
