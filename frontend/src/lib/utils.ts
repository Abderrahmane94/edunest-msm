import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge doesn't know about our custom font-size utilities (text-label,
// text-body, text-section, etc.) so it incorrectly treats them as text-color
// classes and removes text-white / text-danger when they share the same element.
// Registering them as font-size classes fixes the conflict.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-micro',
        'text-caption',
        'text-caption-md',
        'text-label',
        'text-body',
        'text-body-lg',
        'text-subsection',
        'text-section',
        'text-page-title',
        'text-display',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
