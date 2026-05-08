import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the auth service before importing socket service
vi.mock('../modules/auth/auth.service', () => ({
  authService: {
    verifyAccessToken: vi.fn(),
  },
}));

import { authService } from '../modules/auth/auth.service';
import http from 'http';
import { Server } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';

// We need to test the SocketService class directly
// Re-import after mocks are set up
const { socketService } = await import('./socket.service');

describe('SocketService', () => {
  let httpServer: http.Server;
  let port: number;

  beforeEach(() => {
    httpServer = http.createServer();
  });

  describe('initialize', () => {
    it('should create a Socket.io server instance', () => {
      socketService.initialize(httpServer);
      const io = socketService.getIO();
      expect(io).toBeInstanceOf(Server);
    });
  });

  describe('JWT authentication middleware', () => {
    let clientSocket: ClientSocket;

    beforeEach((ctx) => {
      return new Promise<void>((resolve) => {
        socketService.initialize(httpServer);
        httpServer.listen(0, () => {
          const address = httpServer.address();
          port = typeof address === 'object' && address ? address.port : 0;
          resolve();
        });
      });
    });

    afterEach(() => {
      return new Promise<void>((resolve) => {
        if (clientSocket) clientSocket.disconnect();
        httpServer.close(() => resolve());
      });
    });

    it('should reject connection when no token is provided', () => {
      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          autoConnect: false,
        });

        clientSocket.on('connect_error', (err) => {
          expect(err.message).toBe('Authentication token is required');
          resolve();
        });

        clientSocket.connect();
      });
    });

    it('should reject connection when token is invalid', () => {
      vi.mocked(authService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          auth: { token: 'invalid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect_error', (err) => {
          expect(err.message).toBe('Invalid or expired authentication token');
          resolve();
        });

        clientSocket.connect();
      });
    });

    it('should accept connection with valid token and auto-join rooms', () => {
      const mockPayload = {
        userId: 'user-123',
        schoolId: 'school-456',
        role: 'teacher' as const,
      };
      vi.mocked(authService.verifyAccessToken).mockReturnValue(mockPayload);

      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          auth: { token: 'valid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          // Connection succeeded — JWT was verified
          expect(clientSocket.connected).toBe(true);

          // Verify the socket joined the expected rooms
          const io = socketService.getIO()!;
          const serverSocket = io.sockets.sockets.get(clientSocket.id!);
          expect(serverSocket).toBeDefined();
          expect(serverSocket!.rooms.has(`user:user-123`)).toBe(true);
          expect(serverSocket!.rooms.has(`school:school-456`)).toBe(true);
          resolve();
        });

        clientSocket.connect();
      });
    });
  });

  describe('emitToRoom', () => {
    let clientSocket: ClientSocket;

    beforeEach(() => {
      return new Promise<void>((resolve) => {
        const mockPayload = {
          userId: 'user-abc',
          schoolId: 'school-xyz',
          role: 'parent' as const,
        };
        vi.mocked(authService.verifyAccessToken).mockReturnValue(mockPayload);

        socketService.initialize(httpServer);
        httpServer.listen(0, () => {
          const address = httpServer.address();
          port = typeof address === 'object' && address ? address.port : 0;
          resolve();
        });
      });
    });

    afterEach(() => {
      return new Promise<void>((resolve) => {
        if (clientSocket) clientSocket.disconnect();
        httpServer.close(() => resolve());
      });
    });

    it('should emit event to all sockets in a room', () => {
      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          auth: { token: 'valid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          // The client is auto-joined to user:user-abc room
          clientSocket.on('notification:new', (data) => {
            expect(data).toEqual({ message: 'Hello' });
            resolve();
          });

          // Emit to the user's room
          socketService.emitToRoom('user:user-abc', 'notification:new', { message: 'Hello' });
        });

        clientSocket.connect();
      });
    });
  });

  describe('emitToUser', () => {
    let clientSocket: ClientSocket;

    beforeEach(() => {
      return new Promise<void>((resolve) => {
        const mockPayload = {
          userId: 'user-emit-test',
          schoolId: 'school-emit-test',
          role: 'admin' as const,
        };
        vi.mocked(authService.verifyAccessToken).mockReturnValue(mockPayload);

        socketService.initialize(httpServer);
        httpServer.listen(0, () => {
          const address = httpServer.address();
          port = typeof address === 'object' && address ? address.port : 0;
          resolve();
        });
      });
    });

    afterEach(() => {
      return new Promise<void>((resolve) => {
        if (clientSocket) clientSocket.disconnect();
        httpServer.close(() => resolve());
      });
    });

    it('should emit event to a specific user via their personal room', () => {
      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          auth: { token: 'valid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          clientSocket.on('message:new', (data) => {
            expect(data).toEqual({ text: 'New message' });
            resolve();
          });

          socketService.emitToUser('user-emit-test', 'message:new', { text: 'New message' });
        });

        clientSocket.connect();
      });
    });
  });

  describe('joinRoom / leaveRoom', () => {
    let clientSocket: ClientSocket;

    beforeEach(() => {
      return new Promise<void>((resolve) => {
        const mockPayload = {
          userId: 'user-room-test',
          schoolId: 'school-room-test',
          role: 'teacher' as const,
        };
        vi.mocked(authService.verifyAccessToken).mockReturnValue(mockPayload);

        socketService.initialize(httpServer);
        httpServer.listen(0, () => {
          const address = httpServer.address();
          port = typeof address === 'object' && address ? address.port : 0;
          resolve();
        });
      });
    });

    afterEach(() => {
      return new Promise<void>((resolve) => {
        if (clientSocket) clientSocket.disconnect();
        httpServer.close(() => resolve());
      });
    });

    it('should join a socket to a room and receive events', () => {
      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          auth: { token: 'valid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          // Join a conversation room
          socketService.joinRoom(clientSocket.id!, 'conversation:conv-123');

          clientSocket.on('message:new', (data) => {
            expect(data).toEqual({ content: 'Hello from conversation' });
            resolve();
          });

          // Small delay to ensure room join is processed
          setTimeout(() => {
            socketService.emitToRoom('conversation:conv-123', 'message:new', {
              content: 'Hello from conversation',
            });
          }, 50);
        });

        clientSocket.connect();
      });
    });

    it('should leave a room and stop receiving events', () => {
      return new Promise<void>((resolve) => {
        clientSocket = ClientIO(`http://localhost:${port}`, {
          auth: { token: 'valid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          // Join then leave a classroom room
          socketService.joinRoom(clientSocket.id!, 'classroom:class-456');
          socketService.leaveRoom(clientSocket.id!, 'classroom:class-456');

          let received = false;
          clientSocket.on('announcement:new', () => {
            received = true;
          });

          // Emit to the room after leaving
          setTimeout(() => {
            socketService.emitToRoom('classroom:class-456', 'announcement:new', { title: 'Test' });
          }, 50);

          // Verify nothing was received
          setTimeout(() => {
            expect(received).toBe(false);
            resolve();
          }, 150);
        });

        clientSocket.connect();
      });
    });
  });
});
