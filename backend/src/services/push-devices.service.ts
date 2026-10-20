/**
 * The devices each person allowed notifications on (phone, computer...).
 * A notification goes to all of them; a device Firebase no longer knows
 * (app removed, permission taken back) is dropped on the first failed send.
 */

import prisma from '../lib/prisma';
import { pushService, PushTokenInvalidError } from './push.service';
import { cloudinaryService } from './cloudinary.service';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  tag?: string;
  lang?: 'fr' | 'ar';
}

export interface PushResult {
  /** Devices this person has. */
  devices: number;
  /** Devices Firebase accepted the notification for. */
  sent: number;
  /** False when the server has no Firebase key: nothing can leave. */
  configured: boolean;
}

export const pushDevices = {
  /**
   * This device now notifies this person. A device used before by another
   * account (a shared phone) moves to this one: the previous account's
   * notifications no longer show on it.
   */
  async register(userId: string, token: string): Promise<void> {
    await prisma.pushDevice.upsert({
      where: { token },
      create: { userId, token },
      update: { userId, lastSeenAt: new Date() },
    });
  },

  /** On sign out: this device stops notifying this person. */
  async unregister(userId: string, token: string): Promise<void> {
    await prisma.pushDevice.deleteMany({ where: { userId, token } });
  },

  /** Sends to every device of this person. Never throws. */
  async send(userId: string, message: PushMessage): Promise<PushResult> {
    const devices = await prisma.pushDevice
      .findMany({ where: { userId }, select: { token: true } })
      .catch((err) => {
        console.error('[PushDevices] Could not read the devices:', err);
        return [] as { token: string }[];
      });
    // Without a picture of its own (the sender's photo), the school's logo.
    const icon = message.icon ?? (devices.length ? await schoolLogo(userId) : undefined);
    const results = await Promise.allSettled(
      devices.map((d) => pushService.send({ token: d.token, ...message, ...(icon && { icon }) })),
    );
    const invalid: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected' && r.reason instanceof PushTokenInvalidError) invalid.push(devices[i].token);
    });
    if (invalid.length) {
      await prisma.pushDevice.deleteMany({ where: { token: { in: invalid } } }).catch(() => undefined);
    }
    return {
      devices: devices.length - invalid.length,
      sent: pushService.isConfigured ? results.filter((r) => r.status === 'fulfilled').length : 0,
      configured: pushService.isConfigured,
    };
  },
};

/** The logo of the person's school, as a notification picture. */
async function schoolLogo(userId: string): Promise<string | undefined> {
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { school: { select: { logoPublicId: true } } } })
    .catch(() => null);
  const logo = user?.school?.logoPublicId;
  return (logo && cloudinaryService.notificationIconUrl(logo, 'pad')) || undefined;
}
