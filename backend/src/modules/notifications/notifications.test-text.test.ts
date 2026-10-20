import { describe, it, expect } from 'vitest';
import { testNotificationText } from './notifications.controller';

describe('testNotificationText', () => {
  it('tells a parent what will arrive, with the school', () => {
    expect(testNotificationText('fr', 'parent', 'Les Lilas')).toEqual({
      title: 'Notifications activées ✅',
      body: "Vous recevrez ici les messages de Les Lilas, les absences de vos enfants et les annonces, même quand l'application est fermée.",
    });
  });

  it('tells the staff, in Arabic', () => {
    expect(testNotificationText('ar', 'teacher', 'روضة النور')).toEqual({
      title: 'الإشعارات مفعّلة ✅',
      body: 'ستصلك هنا رسائل الأولياء والفريق والإعلانات من روضة النور، حتى عندما يكون التطبيق مغلقًا.',
    });
  });

  it('without a school (platform)', () => {
    expect(testNotificationText('fr', 'super_admin', null).body).toBe(
      "Vous recevrez ici les messages des parents et de l'équipe, même quand l'application est fermée.",
    );
  });
});
