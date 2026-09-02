import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { authService } from '../modules/auth/auth.service';
import prisma from '../lib/prisma';
import type { TokenPayload } from '../modules/auth/auth.types';

// --- Types ---

export type SocketEvent =
  | 'message:new'
  | 'message:read'
  | 'staff_message:new'
  | 'staff_message:read'
  | 'report:new'
  | 'report:updated'
  | 'announcement:new'
  | 'notification:new';

export type RoomPattern =
  | `school:${string}`
  | `classroom:${string}`
  | `conversation:${string}`
  | `staff_conversation:${string}`
  | `user:${string}`;

export interface ISocketService {
  emitToRoom(room: string, event: SocketEvent, data: unknown): void;
  emitToUser(userId: string, event: SocketEvent, data: unknown): void;
  joinRoom(socketId: string, room: string): void;
  leaveRoom(socketId: string, room: string): void;
}

// Extend Socket to include authenticated user data
interface AuthenticatedSocket extends Socket {
  data: {
    user: TokenPayload;
  };
}

// --- Implementation ---

class SocketService implements ISocketService {
  private io: Server | null = null;

  /**
   * Initialize the Socket.io server and attach it to the HTTP server.
   * Configures JWT authentication middleware and room auto-join on connection.
   */
  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').concat(['http://localhost:5174']),
        credentials: true,
      },
    });

    // JWT authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;

      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      try {
        const payload = authService.verifyAccessToken(token);
        (socket as AuthenticatedSocket).data = { user: payload };
        next();
      } catch {
        return next(new Error('Invalid or expired authentication token'));
      }
    });

    // Connection handler — auto-join personal and school rooms
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const { userId, schoolId, role } = authSocket.data.user;

      // Auto-join user to their personal room and school room
      const userRoom: RoomPattern = `user:${userId}`;
      const schoolRoom: RoomPattern = `school:${schoolId}`;

      socket.join(userRoom);
      socket.join(schoolRoom);

      console.log(`[Socket] User ${userId} connected — joined rooms: ${userRoom}, ${schoolRoom}`);

      // Clients request to join room-scoped events (e.g. a conversation, while
      // that chat is open) via these — only conversation rooms are grantable
      // here, and only to participants/admins of that conversation's school.
      socket.on('join', async (room: unknown) => {
        if (typeof room !== 'string') return;
        if (await this.canJoinRoom(room, userId, schoolId, role)) {
          socket.join(room);
        }
      });

      socket.on('leave', (room: unknown) => {
        if (typeof room !== 'string') return;
        socket.leave(room);
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] User ${userId} disconnected`);
      });
    });
  }

  /**
   * Authorizes a client-requested room join. Only conversation rooms can be
   * joined this way (user/school rooms are auto-joined on connect and not
   * client-requestable), and only by that conversation's participants or an
   * admin/super_admin of the same school.
   */
  private async canJoinRoom(
    room: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<boolean> {
    const match = /^conversation:(.+)$/.exec(room);
    if (!match) return false;

    const conversation = await prisma.conversation.findUnique({ where: { id: match[1] } });
    if (!conversation || conversation.schoolId !== schoolId) return false;

    if (role === 'admin' || role === 'super_admin') return true;
    return userId === conversation.teacherUserId || userId === conversation.parentUserId;
  }

  /**
   * Emit an event to all sockets in a specific room.
   */
  emitToRoom(room: string, event: SocketEvent, data: unknown): void {
    if (!this.io) {
      console.warn('[Socket] Server not initialized — cannot emit to room');
      return;
    }
    this.io.to(room).emit(event, data);
  }

  /**
   * Emit an event to a specific user via their personal room.
   */
  emitToUser(userId: string, event: SocketEvent, data: unknown): void {
    const userRoom: RoomPattern = `user:${userId}`;
    this.emitToRoom(userRoom, event, data);
  }

  /**
   * Join a socket to a specific room (e.g., conversation or classroom room).
   */
  joinRoom(socketId: string, room: string): void {
    if (!this.io) {
      console.warn('[Socket] Server not initialized — cannot join room');
      return;
    }
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(room);
    }
  }

  /**
   * Remove a socket from a specific room.
   */
  leaveRoom(socketId: string, room: string): void {
    if (!this.io) {
      console.warn('[Socket] Server not initialized — cannot leave room');
      return;
    }
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(room);
    }
  }

  /**
   * Get the underlying Socket.io server instance (for advanced use cases).
   */
  getIO(): Server | null {
    return this.io;
  }
}

// Export singleton instance
export const socketService = new SocketService();
