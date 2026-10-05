import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    conversation: { findUnique: vi.fn() },
    staffConversation: { findUnique: vi.fn() },
  },
}));
vi.mock('../modules/auth/auth.service', () => ({ authService: { verifyAccessToken: vi.fn() } }));

import prisma from '../lib/prisma';
import { socketService } from './socket.service';

const mockPrisma = prisma as unknown as {
  conversation: { findUnique: ReturnType<typeof vi.fn> };
  staffConversation: { findUnique: ReturnType<typeof vi.fn> };
};

describe('socketService.canJoinRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('staff conversation rooms', () => {
    const staffConversation = { id: 'sc-1', schoolId: 'school-1', initiatorId: 'admin-1', recipientId: 'teacher-1' };

    it('lets both participants join (live messages between admin and teacher)', async () => {
      mockPrisma.staffConversation.findUnique.mockResolvedValue(staffConversation);

      expect(await socketService.canJoinRoom('staff_conversation:sc-1', 'admin-1', 'school-1', 'admin')).toBe(true);
      expect(await socketService.canJoinRoom('staff_conversation:sc-1', 'teacher-1', 'school-1', 'teacher')).toBe(true);
    });

    it("keeps other staff out, admins included", async () => {
      mockPrisma.staffConversation.findUnique.mockResolvedValue(staffConversation);

      expect(await socketService.canJoinRoom('staff_conversation:sc-1', 'teacher-2', 'school-1', 'teacher')).toBe(false);
      expect(await socketService.canJoinRoom('staff_conversation:sc-1', 'admin-2', 'school-1', 'admin')).toBe(false);
    });

    it('refuses a conversation of another school', async () => {
      mockPrisma.staffConversation.findUnique.mockResolvedValue(staffConversation);

      expect(await socketService.canJoinRoom('staff_conversation:sc-1', 'admin-1', 'school-2', 'admin')).toBe(false);
    });
  });

  describe('teacher ↔ parent conversation rooms', () => {
    const conversation = { id: 'c-1', schoolId: 'school-1', teacherUserId: 'teacher-1', parentUserId: 'parent-1' };

    it('lets participants and school admins join', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);

      expect(await socketService.canJoinRoom('conversation:c-1', 'parent-1', 'school-1', 'parent')).toBe(true);
      expect(await socketService.canJoinRoom('conversation:c-1', 'admin-9', 'school-1', 'admin')).toBe(true);
      expect(await socketService.canJoinRoom('conversation:c-1', 'parent-2', 'school-1', 'parent')).toBe(false);
    });
  });

  it('refuses any other room', async () => {
    expect(await socketService.canJoinRoom('school:school-1', 'admin-1', 'school-1', 'admin')).toBe(false);
    expect(await socketService.canJoinRoom('user:someone-else', 'admin-1', 'school-1', 'admin')).toBe(false);
  });
});
