import { cn } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeMap: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-micro',
  sm: 'w-8 h-8 text-caption',
  md: 'w-10 h-10 text-body',
  lg: 'w-14 h-14 text-subsection',
};

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

// The same name always gets the same color.
const AVATAR_COLORS = [
  'bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]',
  'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
  'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  'bg-[var(--color-pink-muted)] text-[var(--color-pink)]',
  'bg-[var(--color-sky-muted)] text-[var(--color-sky)]',
  'bg-[var(--color-teal-muted)] text-[var(--color-teal)]',
  'bg-[var(--color-sun-muted)] text-[#A86C00]',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? '').toUpperCase();
}

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
  const initials = name ? getInitials(name) : '';

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={cn(
          'rounded-full object-cover shrink-0',
          sizeMap[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center font-semibold',
        avatarColor(name || alt || ''),
        sizeMap[size],
        className
      )}
      aria-label={alt || name || 'Avatar'}
      role="img"
    >
      {initials}
    </div>
  );
}
