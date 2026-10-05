import * as React from 'react';
import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { enqueue, registerQueueHandler, useOfflineQueue, QueueRejectedError, type QueuedAction } from '@/lib/offlineQueue';

/**
 * Text messages go through the offline queue: written without a connection,
 * they're kept on the device and sent when it returns (online, right away).
 * Each carries an id made on the device, so a message sent again is only
 * saved once.
 */

/** 'parent': teacher ↔ parent conversations; 'staff': conversations between staff. */
export type MessageScope = 'parent' | 'staff';

export interface MessagePayload {
  scope: MessageScope;
  conversationId: string;
  content: string;
  clientId: string;
  writtenAt: string;
}

export const MESSAGE = 'message';

const ENDPOINT: Record<MessageScope, (conversationId: string) => string> = {
  parent: (id) => `/communication/conversations/${id}/messages`,
  staff: (id) => `/communication/staff/conversations/${id}/messages`,
};

const QUERY_KEYS: Record<MessageScope, { messages: string; conversations: string }> = {
  parent: { messages: 'messages', conversations: 'conversations' },
  staff: { messages: 'staff-messages', conversations: 'staff-conversations' },
};

registerQueueHandler<MessagePayload>(MESSAGE, {
  send: async (payload) => {
    const res = await apiClient.post(ENDPOINT[payload.scope](payload.conversationId), {
      content: payload.content,
      messageType: 'text',
      clientId: payload.clientId,
    });
    if (!res.success) {
      // An expired session isn't a refusal of the message: keep it until the
      // user is signed in again.
      if (res.error?.code === 'UNAUTHORIZED') throw new Error('UNAUTHORIZED');
      throw new QueueRejectedError(res.error?.message || 'Failed to send message');
    }
    // Show the sent message before dropping its "waiting" bubble.
    const keys = QUERY_KEYS[payload.scope];
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [keys.messages, payload.conversationId] }),
      queryClient.invalidateQueries({ queryKey: [keys.conversations] }),
    ]);
  },
});

/** Sends a text message (or keeps it for later when offline). */
export function sendTextMessage(scope: MessageScope, conversationId: string, content: string): Promise<void> {
  const clientId = crypto.randomUUID();
  return enqueue<MessagePayload>(MESSAGE, `message:${clientId}`, {
    scope,
    conversationId,
    content,
    clientId,
    writtenAt: new Date().toISOString(),
  });
}

/** Messages of a conversation still waiting to be sent (or refused). */
export function usePendingMessages(scope: MessageScope, conversationId: string | null | undefined) {
  const { actions, syncing } = useOfflineQueue();
  const pending = React.useMemo(
    () =>
      actions.filter(
        (a): a is QueuedAction<MessagePayload> =>
          a.kind === MESSAGE &&
          (a.payload as MessagePayload).scope === scope &&
          (a.payload as MessagePayload).conversationId === conversationId,
      ),
    [actions, scope, conversationId],
  );
  return { pending, syncing };
}
