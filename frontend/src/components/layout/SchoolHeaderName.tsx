import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchoolBrand } from '@/hooks/useSchool';
import { cn } from '@/lib/utils';
import { BrandMark, KiddooLogo } from './BrandMark';

const ARABIC = /[؀-ۿ]/;

/**
 * A name written in both languages ("روضة النور / Maternelle An-Nour"): the
 * part in the reader's language. Any other name as it is.
 */
export function nameInLanguage(name: string, lang: string): string {
  const parts = name.split(/\s+[/|–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return name;
  const arabic = parts.find((p) => ARABIC.test(p) && !/[A-Za-z]/.test(p));
  const latin = parts.find((p) => !ARABIC.test(p));
  if (!arabic || !latin) return name;
  return lang === 'ar' ? arabic : latin;
}

/**
 * The top of a parent's or a teacher's screens: their school's logo and name.
 * Until they are known (or when the school has no logo), the Kiddoo mark.
 */
export function SchoolHeaderName({ nameClassName }: { nameClassName?: string }) {
  const { data: brand } = useSchoolBrand();
  const { i18n } = useTranslation();
  const [logoFailed, setLogoFailed] = useState(false);

  if (!brand) {
    return (
      <div className="flex items-center min-w-0">
        <KiddooLogo className="h-6" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {brand.logoUrl && !logoFailed ? (
        <img
          src={brand.logoUrl}
          alt=""
          width={30}
          height={30}
          className="w-[30px] h-[30px] rounded-lg object-cover shrink-0"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <BrandMark size={30} className="shrink-0" />
      )}
      <span
        className={cn('font-playful text-[15px] font-bold leading-tight text-text-heading line-clamp-2 [overflow-wrap:anywhere]', nameClassName)}
        dir="auto"
        title={brand.name}
      >
        {nameInLanguage(brand.name, i18n.language)}
      </span>
    </div>
  );
}
