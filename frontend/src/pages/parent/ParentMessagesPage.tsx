import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useChatSend } from '@/components/messaging/useChatSend';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Paperclip,
  Image,
  FileText,
  ArrowLeft,
  MessageCircle,
  Plus,
  Building2,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { Avatar, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { PendingMessageBubble } from '@/components/messaging/PendingMessageBubble';
import { sendTextMessage, usePendingMessages } from '@/hooks/useMessageSync';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import {
  useConversations,
  useMessages,
  useSendFileMessage,
  useMarkMessageRead,
  useCreateConversation,
  useMessageContacts,
  type Conversation,
} from '@/hooks/useMessaging';
import { messagePreview } from '@/components/messaging/messagePreview';

export function ParentMessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const conversationIdParam = searchParams.get('conversationId');

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(
    conversationIdParam,
  );
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showNewMessage, setShowNewMessage] = React.useState(false);

  // Re-select when navigating here again (e.g. from another notification)
  // while this page is already mounted.
  React.useEffect(() => {
    if (conversationIdParam) setActiveConversationId(conversationIdParam);
  }, [conversationIdParam]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(
    activeConversationId ?? undefined
  );

  const { pending: pendingMessages, syncing } = usePendingMessages('parent', activeConversationId);
  const sendFileMessage = useSendFileMessage(activeConversationId ?? undefined);
  const chatSend = useChatSend();
  const markRead = useMarkMessageRead();

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  // Open the conversation straight away when there is only one (or on a wide
  // screen, where the list stays beside it) — once, so "back" can return to
  // the list on a phone.
  const autoSelectedRef = React.useRef(!!conversationIdParam);
  React.useEffect(() => {
    if (autoSelectedRef.current || conversations.length === 0 || activeConversationId) return;
    autoSelectedRef.current = true;
    if (conversations.length === 1 || window.matchMedia('(min-width: 1024px)').matches) {
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
  }, [messages, pendingMessages.length]);

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

  // Sent right away, or kept on the device until the connection returns.
  const handleSendMessage = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;
    void sendTextMessage('parent', activeConversationId, trimmed);
    setMessageInput('');
  }, [messageInput, activeConversationId]);

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
      chatSend.sendFile(sendFileMessage, file, messageType);
      setShowAttachMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [activeConversationId, sendFileMessage, chatSend.sendFile]
  );

  const handleSelectConversation = React.useCallback((conversation: Conversation) => {
    setActiveConversationId(conversation.id);
  }, []);

  const handleBack = React.useCallback(() => {
    setActiveConversationId(null);
  }, []);

  return (
    // Fills the screen between the top bar and the bottom tab bar: the message
    // list scrolls inside, so the input always stays in view.
    <div className="h-[calc(100dvh-4rem-var(--tabbar-h))] lg:h-[calc(100dvh-3.5rem)] min-h-[360px] bg-page flex flex-col overflow-hidden">
      {/* Page header */}
      <header className="shrink-0 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-page-title font-semibold text-text-heading">
              {t('parentMessages.title')}
            </h1>
            <p className="text-caption text-text-secondary">
              {t('parentMessages.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewMessage(true)}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-caption font-medium hover:bg-[var(--color-accent-hover)] active:scale-[0.98] transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            {t('parentMessages.newMessage')}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col max-w-[600px] mx-auto w-full">
        {/* Conversation list (shown when no active conversation on mobile, or when multiple conversations) */}
        {conversations.length > 1 && (
          <aside
            className={cn(
              'border-b border-border bg-card overflow-y-auto',
              activeConversationId ? 'hidden lg:block lg:max-h-48' : 'block flex-1'
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
                            <span className="text-caption font-normal text-text-secondary">
                              {' · '}
                              {conversation.with_office ? t('parentMessages.office') : t('parentMessages.teacher')}
                            </span>
                          </span>
                          {conversation.unread_count > 0 && (
                            <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                        {conversation.last_message && (
                          <p className="text-caption text-text-secondary truncate mt-0.5">
                            {messagePreview(conversation.last_message, t)}
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
        <main className={cn('flex-1 flex-col min-h-0', conversations.length > 1 && !activeConversationId ? 'hidden lg:flex' : 'flex')}>
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
                {conversations.length === 0
                  ? t('parentMessages.noConversations')
                  : t('messages.selectConversation')}
              </p>
              {conversations.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewMessage(true)}
                  className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-body font-medium hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  {t('parentMessages.newMessage')}
                </button>
              )}
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
                    aria-label={t('parentMessages.back')}
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
                    {activeConversation?.with_office ? t('parentMessages.office') : t('parentMessages.teacher')}
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
                ) : messages.length === 0 && pendingMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-body text-text-secondary">
                      {t('parentMessages.noMessages')}
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isSent={message.sender_user_id === user?.id}
                        i18nNamespace="parentMessages"
                      />
                    ))}
                    {pendingMessages.map((action) => (
                      <PendingMessageBubble key={action.id} action={action} syncing={syncing} />
                    ))}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="shrink-0 bg-card border-t border-border p-3">
                <ErrorAlert message={chatSend.error} onDismiss={chatSend.clearError} className="mb-2" />
                <div className="flex items-end gap-2">
                  {/* Attachment button */}
                  <div className="relative" ref={attachMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-hover text-text-secondary hover:text-text-primary transition-colors duration-150"
                      aria-label={t('parentMessages.attach')}
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
                          {t('parentMessages.sendPhoto')}
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors duration-150"
                        >
                          <FileText className="w-4 h-4 text-text-secondary" />
                          {t('parentMessages.sendDocument')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Text input */}
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('parentMessages.placeholder')}
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-[120px] bg-subtle border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-none"
                    aria-label={t('parentMessages.inputLabel')}
                  />

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className={cn(
                      'flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all duration-150 active:scale-[0.98]',
                      messageInput.trim()
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
                        : 'bg-subtle text-text-disabled cursor-not-allowed'
                    )}
                    aria-label={t('parentMessages.send')}
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

      <NewMessageDialog
        open={showNewMessage}
        onOpenChange={setShowNewMessage}
        onOpened={(id) => {
          setActiveConversationId(id);
          setShowNewMessage(false);
        }}
      />
    </div>
  );
}

/**
 * Start (or reopen) a conversation about one of the parent's children, with
 * the child's teacher or with the school office.
 */
function NewMessageDialog({
  open,
  onOpenChange,
  onOpened,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: contacts = [], isLoading } = useMessageContacts(open);
  const createConversation = useCreateConversation();

  const start = (childId: string, withOffice: boolean) => {
    createConversation.mutate(
      { childId, withOffice },
      {
        onSuccess: (data) => {
          const conv = (data as { conversation?: { id: string } })?.conversation ?? data;
          const id = (conv as { id?: string })?.id;
          if (id) onOpened(id);
          else onOpenChange(false);
        },
      },
    );
  };

  const optionClass =
    'flex-1 flex items-center gap-2 min-h-[52px] px-3 rounded-lg border border-border text-start hover:bg-hover hover:border-[var(--color-border-strong)] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('parentMessages.newMessage')}</DialogTitle>
          <DialogDescription>{t('parentMessages.newMessageHint')}</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading && <div className="animate-pulse h-24 bg-subtle rounded-lg" />}
          {!isLoading && contacts.length === 0 && (
            <p className="text-body text-text-secondary text-center py-4">{t('parentMessages.noChildren')}</p>
          )}
          {contacts.map((c) => (
            <div key={c.childId} className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                <span className="text-body font-medium text-text-heading">
                  {c.firstName} {c.lastName}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => start(c.childId, false)}
                  disabled={!c.teacherName || createConversation.isPending}
                  className={optionClass}
                >
                  <GraduationCap className="w-5 h-5 shrink-0 text-[var(--color-accent)]" />
                  <span className="min-w-0">
                    <span className="block text-body font-medium text-text-primary">{t('parentMessages.teacher')}</span>
                    <span className="block text-caption text-text-secondary truncate">
                      {c.teacherName ?? t('parentMessages.noTeacherYet')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => start(c.childId, true)}
                  disabled={createConversation.isPending}
                  className={optionClass}
                >
                  <Building2 className="w-5 h-5 shrink-0 text-[var(--color-accent)]" />
                  <span className="min-w-0">
                    <span className="block text-body font-medium text-text-primary">{t('parentMessages.office')}</span>
                    <span className="block text-caption text-text-secondary truncate">{t('parentMessages.officeHint')}</span>
                  </span>
                </button>
              </div>
            </div>
          ))}
          {createConversation.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center">
              {errorMessage(createConversation.error, t)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

