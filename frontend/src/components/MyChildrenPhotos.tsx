import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ChildPhotoEditor } from '@/components/ChildPhotoEditor';
import { useMyChildren } from '@/hooks/useChildPhoto';

/** A parent's children, each with their photo to add, change or remove. */
export function MyChildrenPhotos() {
  const { t } = useTranslation();
  const { data: children = [] } = useMyChildren();
  const { hash } = useLocation();
  const section = React.useRef<HTMLElement>(null);
  // Opened from the feed's invitation: straight to the children.
  React.useEffect(() => {
    if (hash === '#children' && children.length) section.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, children.length]);
  if (!children.length) return null;
  return (
    <section ref={section} id="children" className="bg-card border border-border rounded-lg p-6 space-y-4 scroll-mt-20">
      <div>
        <h2 className="text-subsection font-semibold text-text-heading">{t('childPhoto.myChildrenTitle')}</h2>
        <p className="text-caption text-text-secondary">{t('childPhoto.myChildrenHint')}</p>
      </div>
      <ul className="space-y-4">
        {children.map((c) => (
          <li key={c.id}>
            <ChildPhotoEditor
              childId={c.id}
              name={`${c.firstName} ${c.lastName}`.trim()}
              photoUrl={c.photoUrl}
              photoConsentAt={c.photoConsentAt}
              photoConsentByName={c.photoConsentByName}
              mode="parent"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
