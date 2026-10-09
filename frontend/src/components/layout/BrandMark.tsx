import * as React from 'react';

/**
 * The EduNest logo: a house where an adult holds a child, on two leaves.
 * Drawn inline (no file to fetch, so it shows offline too). Below 48 px the
 * simplified mark is used: rays, faces and other small details disappear at
 * that size. Source files: public/brand/logo.svg and logo-small.svg.
 */
export function BrandMark({
  size = 32,
  variant = size < 48 ? 'small' : 'full',
  className,
  title,
}: {
  size?: number;
  variant?: 'full' | 'small';
  className?: string;
  /** Accessible name; without it the mark is decorative (the name is written next to it). */
  title?: string;
}) {
  // Two marks on one page (e.g. the sign-in page's desktop and phone headers) need their own mask ids.
  const id = React.useId().replace(/:/g, '');
  const gaps = `brand-gaps-${id}`;
  const childGap = `brand-child-gap-${id}`;
  const full = variant === 'full';

  return (
    <svg
      viewBox={full ? '164 146 940 940' : '200 196 860 860'}
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Gaps around the heads, cut out so whatever is behind the logo shows through. */}
        <mask id={gaps} maskUnits="userSpaceOnUse" x="164" y="146" width="940" height="940">
          <rect x="164" y="146" width="940" height="940" fill="#fff" />
          <ellipse cx="590" cy="528" rx="166" ry="152" fill="#000" />
          <ellipse cx="700" cy="712" rx="114" ry="94" fill="#000" />
        </mask>
        <mask id={childGap} maskUnits="userSpaceOnUse" x="164" y="146" width="940" height="940">
          <rect x="164" y="146" width="940" height="940" fill="#fff" />
          <ellipse cx="700" cy="712" rx="114" ry="94" fill="#000" />
        </mask>
      </defs>

      {full && (
        <g stroke="#FFC145" strokeWidth="58" strokeLinecap="round" fill="none">
          <path d="M797 193 L786 248" />
          <path d="M930 264 L884 306" />
          <path d="M1002 376 L950 383" />
        </g>
      )}

      {/* house */}
      <g stroke="#5B55D6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M287 518 L628 263 L967 518" strokeWidth="92" />
        <path d="M323 572 V692" strokeWidth="66" />
        <path d="M930 572 V692" strokeWidth="66" />
      </g>

      {/* leaves, like two hands holding them */}
      <path d="M280 812 C292 772 336 768 398 810 C480 864 560 910 672 926 C620 972 524 1006 440 996 C330 982 268 894 280 812 Z" fill="#5BAF94" />
      <path d="M970 822 C974 792 952 784 926 802 C852 862 730 962 487 1030 C600 1082 762 1072 862 990 C940 926 976 866 970 822 Z" fill="#A2CD79" />

      {/* adult: body and the arm that holds the child, then the head */}
      <path
        mask={`url(#${gaps})`}
        fill="#6C5FDB"
        d="M470 600 C408 640 380 706 380 762 C470 832 600 900 720 886 C792 876 842 840 846 790 C849 760 820 742 800 758 C780 790 750 806 710 806 C620 806 545 750 528 650 C505 640 485 625 470 600 Z"
      />
      <ellipse mask={`url(#${childGap})`} cx="590" cy="528" rx="146" ry="132" fill="#6C5FDB" />

      {/* child */}
      {full && <path d="M558 746 C600 762 682 792 772 800 C744 832 694 842 650 834 C598 822 566 792 558 746 Z" fill="#FFCB65" />}
      <ellipse cx="700" cy="712" rx="92" ry="74" fill="#F79A57" />
      {full && (
        <path d="M752 652 C744 638 744 622 756 616 C766 612 774 622 772 636 C782 628 798 634 796 648 C794 662 776 666 764 660 Z" fill="#F79A57" />
      )}

      {full && (
        <g stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" fill="none">
          <path d="M555 566 A23 23 0 0 1 601 566" />
          <path d="M660 566 A23 23 0 0 1 706 566" />
          <path d="M645 720 A15 15 0 0 1 675 720" />
          <path d="M712 740 A15 15 0 0 1 742 740" />
        </g>
      )}

      {/* heart */}
      <path
        d="M842 676 C796 646 786 620 786 603 C786 582 802 568 819 568 C831 568 838 575 842 584 C846 575 853 568 865 568 C882 568 898 582 898 603 C898 620 888 646 842 676 Z"
        fill="#F47B8C"
        transform="rotate(-12 842 620)"
      />
    </svg>
  );
}
