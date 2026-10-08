/**
 * Drawings for the sign-in pages: a sky with a smiling sun and clouds, a
 * rainbow, green hills, a stack of letter blocks and a balloon. Plain SVG,
 * so they stay sharp at every size and need no image download. The drifting
 * and swaying stop when the device asks for less motion (globals.css).
 */

export function NurserySun({ className = '' }: { className?: string }) {
  const rays = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <g className="nest-spin" style={{ transformOrigin: '60px 60px' }}>
        {rays.map((deg) => (
          <rect
            key={deg}
            x="56"
            y="4"
            width="8"
            height="18"
            rx="4"
            fill="#FFC94D"
            transform={`rotate(${deg} 60 60)`}
          />
        ))}
      </g>
      <circle cx="60" cy="60" r="30" fill="#FFD66B" />
      <circle cx="49" cy="56" r="3.2" fill="#7A4B12" />
      <circle cx="71" cy="56" r="3.2" fill="#7A4B12" />
      <path d="M48 67 Q60 78 72 67" stroke="#7A4B12" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <circle cx="42" cy="66" r="4" fill="#FFAA8A" opacity="0.7" />
      <circle cx="78" cy="66" r="4" fill="#FFAA8A" opacity="0.7" />
    </svg>
  );
}

export function NurseryCloud({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <g fill="#FFFFFF">
        <circle cx="34" cy="38" r="18" />
        <circle cx="60" cy="28" r="24" />
        <circle cx="88" cy="38" r="18" />
        <rect x="16" y="38" width="90" height="18" rx="9" />
      </g>
    </svg>
  );
}

const RAINBOW = ['#FF9AA2', '#FFC48C', '#FFE58F', '#B5EAB0', '#9AD8F5'];

export function NurseryRainbow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 112" className={className} aria-hidden="true">
      {RAINBOW.map((color, i) => {
        const r = 100 - i * 14;
        return (
          <path
            key={color}
            d={`M ${110 - r} 110 A ${r} ${r} 0 0 1 ${110 + r} 110`}
            stroke={color}
            strokeWidth="14"
            fill="none"
          />
        );
      })}
    </svg>
  );
}

export function NurseryHills({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 160" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 80 Q150 20 300 70 T600 50 V160 H0Z" fill="#CFEBC4" />
      <path d="M0 120 Q200 60 400 110 T600 100 V160 H0Z" fill="#A9DC9F" />
    </svg>
  );
}

/** Three stacked blocks; the letters follow the page language. */
export function NurseryBlocks({ letters, className = '' }: { letters: [string, string, string]; className?: string }) {
  const blocks = [
    { x: 6, y: 70, fill: '#FF8A80', edge: '#E8685E', letter: letters[0] },
    { x: 72, y: 70, fill: '#7CC6EE', edge: '#56AEDC', letter: letters[2] },
    { x: 39, y: 6, fill: '#FFD166', edge: '#F0B739', letter: letters[1] },
  ];
  return (
    <svg viewBox="0 0 140 132" className={className} aria-hidden="true">
      {blocks.map((b) => (
        <g key={b.x + '-' + b.y}>
          <rect x={b.x} y={b.y + 4} width="60" height="58" rx="10" fill={b.edge} />
          <rect x={b.x} y={b.y} width="60" height="58" rx="10" fill={b.fill} />
          <text
            x={b.x + 30}
            y={b.y + 30}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Baloo Bhaijaan 2', sans-serif"
            fontWeight="800"
            fontSize="32"
            fill="#FFFFFF"
          >
            {b.letter}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function NurseryBalloon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 150" className={`overflow-visible ${className}`} aria-hidden="true">
      <g className="nest-sway" style={{ transformOrigin: '30px 148px' }}>
        <path d="M30 66 Q22 90 32 110 T30 148" stroke="#B9A6C9" strokeWidth="2" fill="none" />
        <ellipse cx="30" cy="34" rx="25" ry="31" fill="#FF8FAB" />
        <ellipse cx="21" cy="22" rx="6" ry="10" fill="#FFFFFF" opacity="0.45" />
        <path d="M25 64 L35 64 L30 70Z" fill="#F07592" />
      </g>
    </svg>
  );
}
