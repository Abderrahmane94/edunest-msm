import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('./communication.service', async () => {
  const actual = await vi.importActual<typeof import('./communication.service')>('./communication.service');
  return {
    ...actual,
    communicationService: { assertCanSendMessage: vi.fn(), sendMessage: vi.fn() },
  };
});
vi.mock('../../services/cloudinary.service', () => ({
  cloudinaryService: { uploadFile: vi.fn() },
}));

import { communicationService, CommunicationServiceError } from './communication.service';
import { cloudinaryService } from '../../services/cloudinary.service';
import { communicationController } from './communication.controller';

const service = communicationService as unknown as {
  assertCanSendMessage: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
};
const upload = cloudinaryService.uploadFile as ReturnType<typeof vi.fn>;

function call(file: { mimetype: string } | undefined, body: Record<string, unknown> = {}) {
  const req = {
    user: { schoolId: 's1', userId: 'parent-1', role: 'parent' },
    params: { id: 'conv-1' },
    file: file && { ...file, buffer: Buffer.from('x') },
    body,
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  const next = vi.fn();
  return { promise: communicationController.sendFileMessage(req, res, next), res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ publicId: 'pub-1' });
  service.sendMessage.mockResolvedValue({ id: 'm1' });
});

describe('POST /conversations/:id/messages/file', () => {
  it('stores the photo, then sends it as a photo message', async () => {
    const { promise, res } = call({ mimetype: 'image/jpeg' }, { message_type: 'photo' });
    await promise;

    expect(upload).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ folder: 'schools/s1/messages', resourceType: 'image' }));
    expect(service.sendMessage).toHaveBeenCalledWith('conv-1', 's1', 'parent-1', 'parent', {
      messageType: 'photo',
      content: undefined,
      cloudinaryPublicId: 'pub-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sends a PDF as a document', async () => {
    const { promise } = call({ mimetype: 'application/pdf' }, { message_type: 'document' });
    await promise;

    expect(upload).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ resourceType: 'raw' }));
    expect(service.sendMessage.mock.calls[0][4]).toMatchObject({ messageType: 'document' });
  });

  it('stores nothing for someone who may not write in the conversation', async () => {
    service.assertCanSendMessage.mockRejectedValue(
      new CommunicationServiceError('Only conversation participants can send messages', 403),
    );
    const { promise, res } = call({ mimetype: 'image/png' });
    await promise;

    expect(upload).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('refuses a request without a file', async () => {
    const { promise, res } = call(undefined);
    await promise;

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
  });
});
