import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Paperclip,
  Image,
  FileText,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import {
  useConversations,
  useMessages,
  useSendMessage,
  useSendFileMessage,
  useMarkMessageRead,
  type Conversation,
} from '@/hooks/useMessaging';

export function ParentMessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(
    activeConversationId ?? undefined
  );

  const sendMessage = useSendMessage(activeConversationId ?? undefined);
  const sendFileMessage = useSendFileMessage(activeConversationId ?? undefined);
  const markRead = useMarkMessageRead();

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  // Auto-select first conversation if only one exists (parent typically has one per child)
  React.useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Join/leave conversation rooms for real-time updates
  React.useEffect(() => {
    if (activeConversationId) {
      joinRoom(`conversation:${activeConversationId}`);
      return () => {
        leaveRoom(`conversation:${activeConversationId}`);
      };
    }
  }, [activeConversationId, joinRoom, leaveRoom]);

  // Listen for new messages via Socket.io
  React.useEffect(() => {
    const unsubNew = on('message:new', (data: unknown) => {
      // Raw socket payload is the backend's response shape (camelCase),
      // unlike the Message type from useMessaging which is mapped to
      // snake_case — read the real field names here.
      const msg = data as { conversationId: string; senderUserId: string; id: string };
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (msg.conversationId === activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
        if (msg.senderUserId !== user?.id) {
          markRead.mutate(msg.id);
        }
      }
    });

    const unsubRead = on('message:read', () => {
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      }
    });

    return () => {
      unsubNew();
      unsubRead();
    };
  }, [on, activeConversationId, user?.id, markRead, queryClient]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark unread messages as read when opening a conversation
  const markedReadRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const unreadMessages = messages.filter(
        (m) => !m.is_read && m.sender_user_id !== user.id && !markedReadRef.current.has(m.id)
      );
      if (unreadMessages.length > 0) {
        unreadMessages.forEach((m) => {
          markedReadRef.current.add(m.id);
          markRead.mutate(m.id);
        });
      }
    }
  }, [messages, user?.id, markRead]);

  // Reset marked-read tracking when conversation changes
  React.useEffect(() => {
    markedReadRef.current.clear();
  }, [activeConversationId]);

  // Close attach menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendMessage = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;
    sendMessage.mutate({ content: trimmed, message_type: 'text' });
    setMessageInput('');
  }, [messageInput, activeConversationId, sendMessage]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, messageType: 'photo' | 'document') => {
      const file = e.target.files?.[0];
      if (!file || !activeConversationId) return;
      sendFileMessage.mutate({ file, messageType });
      setShowAttachMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [activeConversationId, sendFileMessage]
  );

  const handleSelectConversation = React.useCallback((conversation: Conversation) => {
    setActiveConversationId(conversation.id);
  }, []);

  const handleBack = React.useCallback(() => {
    setActiveConversationId(null);
  }, []);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Page header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('parentMessages.title', 'Messages')}
          </h1>
          <p className="text-caption text-text-secondary">
            {t('parentMessages.subtitle', 'Chat with your child\'s teacher')}
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-[600px] mx-auto w-full">
        {/* Conversation list (shown when no active conversation on mobile, or when multiple conversations) */}
        {conversations.length > 1 && (
          <aside
            className={cn(
              'border-b border-border bg-card',
              activeConversationId ? 'hidden lg:block' : 'block'
            )}
          >
            {conversationsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3 p-3">
                    <div className="w-10 h-10 rounded-full bg-subtle" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-subtle rounded w-3/4" />
                      <div className="h-3 bg-subtle rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul role="list" className="divide-y divide-border">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        'w-full flex items-start gap-3 p-4 text-start transition-colors duration-150',
                        activeConversationId === conversation.id
                          ? 'bg-[var(--color-accent-muted)]'
                          : 'hover:bg-hover'
                      )}
                      aria-current={activeConversationId === conversation.id ? 'true' : undefined}
                    >
                      <Avatar name={conversation.child_name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-body font-medium text-text-primary truncate">
                            {conversation.child_name}
                          </span>
                          {conversation.unread_count > 0 && (
                            <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                        {conversation.last_message && (
                          <p className="text-caption text-text-secondary truncate mt-0.5">
                            {conversation.last_message}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {/* Chat area */}
        <main className="flex-1 flex flex-col min-h-0">
          {conversationsLoading ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="space-y-3 w-full max-w-sm">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'animate-pulse h-10 rounded-2xl bg-subtle',
                      i % 2 === 0 ? 'w-2/3 ms-auto' : 'w-2/3'
                    )}
                  />
                ))}
              </div>
            </div>
          ) : !activeConversationId || conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-subtle flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-body text-text-secondary">
                {t('parentMessages.noConversations', 'No conversations yet. Your teacher will reach out soon!')}
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
                {conversations.length > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-hover transition-colors duration-150"
                    aria-label={t('parentMessages.back', 'Back')}
                  >
                    <ArrowLeft className="w-5 h-5 text-text-primary rtl:rotate-180" />
                  </button>
                )}
                <Avatar name={activeConversation?.child_name} size="md" />
                <div className="min-w-0">
                  <p className="text-body font-medium text-text-primary truncate">
                    {activeConversation?.child_name}
                  </p>
                  <p className="text-caption text-text-secondary truncate">
                    {t('parentMessages.teacher', 'Teacher')}
                  </p>
                </div>
              </div>

              {/* Messages area — forced LTR structure so sent messages always
                  align right regardless of interface language (Messenger-style);
                  each bubble's own text still gets its natural direction via dir="auto". */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="ltr">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'animate-pulse h-10 rounded-2xl bg-subtle',
                          i % 2 === 0 ? 'w-2/3 ms-auto' : 'w-2/3'
                        )}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-body text-text-secondary">
                      {t('parentMessages.noMessages', 'No messages yet. Say hello!')}
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isSent={message.sender_user_id === user?.id}
                      i18nNamespace="parentMessages"
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="shrink-0 bg-card border-t border-border p-3">
                <div className="flex items-end gap-2">
                  {/* Attachment button */}
                  <div className="relative" ref={attachMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-hover text-text-secondary hover:text-text-primary transition-colors duration-150"
                      aria-label={t('parentMessages.attach', 'Attach file')}
                      aria-expanded={showAttachMenu}
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    {showAttachMenu && (
                      <div className="absolute bottom-full mb-2 start-0 bg-card border border-border rounded-lg shadow-[0_4px_12px_rgba(15,23,42,0.08)] p-1 min-w-[160px] z-10">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors duration-150"
                        >
                          <Image className="w-4 h-4 text-text-secondary" />
                          {t('parentMessages.sendPhoto', 'Photo')}
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors duration-150"
                        >
                          <FileText className="w-4 h-4 text-text-secondary" />
                          {t('parentMessages.sendDocument', 'Document')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Text input */}
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('parentMessages.placeholder', 'Type a message...')}
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-[120px] bg-subtle border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-none"
                    aria-label={t('parentMessages.inputLabel', 'Message input')}
                  />

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessage.isPending}
                    className={cn(
                      'flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all duration-150 active:scale-[0.98]',
                      messageInput.trim()
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
                        : 'bg-subtle text-text-disabled cursor-not-allowed'
                    )}
                    aria-label={t('parentMessages.send', 'Send message')}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'photo')}
                className="hidden"
                aria-hidden="true"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => handleFileSelect(e, 'document')}
                className="hidden"
                aria-hidden="true"
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

