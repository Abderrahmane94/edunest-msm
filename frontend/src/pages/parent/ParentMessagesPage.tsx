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
  ChevronRight,
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

/** Who a thread is with: the teacher (by id) or the school office. */
function recipientKey(c: Conversation): string {
  return c.with_office ? 'office' : c.teacher_user_id;
}

/** "14:05" today, "12 oct." before. */
function formatListTime(iso: string, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const lang = locale === 'ar' ? 'ar-DZ' : 'fr-FR';
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

/** The person a thread is with, as the parent sees them. */
function RecipientAvatar({ conversation, size = 'md' }: { conversation?: Conversation; size?: 'sm' | 'md' }) {
  if (conversation?.with_office) {
    return (
      <span
        className={cn(
          'shrink-0 grid place-items-center rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent-ink)]',
          size === 'md' ? 'w-10 h-10' : 'w-8 h-8',
        )}
        aria-hidden="true"
      >
        <Building2 className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} />
      </span>
    );
  }
  return <Avatar name={conversation?.teacher_name} size={size} />;
}

export function ParentMessagesPage() {
  const { t, i18n } = useTranslation();
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

  // Threads are shown by who they are with. When the parent has two threads
  // with the same person (one per child), the child's first name tells them apart.
  const sharedRecipients = React.useMemo(() => {
    const seen = new Map<string, number>();
    conversations.forEach((c) => seen.set(recipientKey(c), (seen.get(recipientKey(c)) ?? 0) + 1));
    return new Set([...seen].filter(([, n]) => n > 1).map(([key]) => key));
  }, [conversations]);

  const recipientName = (c?: Conversation) =>
    c?.with_office ? t('parentMessages.office') : (c?.teacher_name || t('parentMessages.teacher'));
  const recipientRole = (c?: Conversation) => {
    if (!c) return '';
    const role = c.with_office ? t('parentMessages.officeHint') : t('parentMessages.teacher');
    return sharedRecipients.has(recipientKey(c)) ? `${role} · ${c.child_name.split(' ')[0]}` : role;
  };

  // On a wide screen, where the list stays beside it, open the latest
  // conversation straight away — once, so the list stays reachable.
  const autoSelectedRef = React.useRef(!!conversationIdParam);
  React.useEffect(() => {
    if (autoSelectedRef.current || conversations.length === 0 || activeConversationId) return;
    autoSelectedRef.current = true;
    if (window.matchMedia('(min-width: 1024px)').matches) {
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

  const newMessageButton = (
    <button
      type="button"
      onClick={() => setShowNewMessage(true)}
      className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-caption font-medium hover:bg-[var(--color-accent-hover)] active:scale-[0.98] transition-all duration-150"
    >
      <Plus className="w-4 h-4" />
      {t('parentMessages.newMessage')}
    </button>
  );

  return (
    // Fills the screen between the top bar (3.5rem + its 1px border) and the
    // bottom tab bar (+ the layout's 0.5rem below it): the message list
    // scrolls inside, so the input always stays in view and the page never does.
    <div className="h-[calc(100dvh-4rem-1px-var(--tabbar-h))] lg:h-[calc(100dvh-3.5rem-1px)] min-h-[360px] bg-page flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto lg:px-4 lg:py-4 flex">
        <div className="flex-1 min-h-0 flex bg-card lg:border lg:border-border lg:rounded-2xl overflow-hidden lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          {/* Conversations */}
          <aside
            className={cn(
              'w-full lg:w-80 lg:shrink-0 flex-col min-h-0 lg:border-e border-border',
              activeConversationId ? 'hidden lg:flex' : 'flex',
            )}
          >
            <header className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-page-title font-semibold text-text-heading">{t('parentMessages.title')}</h1>
                <p className="text-caption text-text-secondary truncate">{t('parentMessages.subtitle')}</p>
              </div>
              {conversations.length > 0 && newMessageButton}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {conversationsLoading ? (
                <div className="p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                      <div className="w-10 h-10 rounded-full bg-subtle" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-subtle rounded w-2/3" />
                        <div className="h-3 bg-subtle rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-accent-muted)] grid place-items-center">
                    <MessageCircle className="w-8 h-8 text-[var(--color-accent)]" />
                  </div>
                  <p className="text-body text-text-secondary max-w-xs">{t('parentMessages.noConversations')}</p>
                  {newMessageButton}
                </div>
              ) : (
                <ul className="p-2 space-y-1">
                  {conversations.map((conversation) => {
                    const active = activeConversationId === conversation.id;
                    const unread = conversation.unread_count > 0;
                    return (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          onClick={() => setActiveConversationId(conversation.id)}
                          aria-current={active ? 'true' : undefined}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl text-start transition-colors duration-150',
                            active ? 'bg-[var(--color-accent-muted)]' : 'hover:bg-hover',
                          )}
                        >
                          <RecipientAvatar conversation={conversation} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className={cn('truncate text-body text-text-heading', unread ? 'font-semibold' : 'font-medium')}>
                                {recipientName(conversation)}
                              </span>
                              <span className={cn('shrink-0 text-micro', unread ? 'text-[var(--color-accent)] font-medium' : 'text-text-secondary')}>
                                {formatListTime(conversation.last_message_at, i18n.language)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className={cn('truncate text-caption', unread ? 'text-text-primary' : 'text-text-secondary')}>
                                {conversation.last_message
                                  ? messagePreview(conversation.last_message, t)
                                  : recipientRole(conversation)}
                              </span>
                              {unread && (
                                <span className="shrink-0 grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                                  {conversation.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="lg:hidden w-4 h-4 shrink-0 text-text-disabled rtl:rotate-180" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Chat */}
          <main className={cn('flex-1 min-w-0 min-h-0 flex-col', activeConversationId ? 'flex' : 'hidden lg:flex')}>
            {!activeConversationId || !activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <MessageCircle className="w-10 h-10 text-text-disabled" />
                <p className="text-body text-text-secondary">
                  {conversations.length === 0 ? t('parentMessages.newMessageHint') : t('messages.selectConversation')}
                </p>
              </div>
            ) : (
              <>
                {/* Who the conversation is with */}
                <div className="shrink-0 flex items-center gap-3 px-3 py-2.5 bg-card border-b border-border">
                  <button
                    type="button"
                    onClick={() => setActiveConversationId(null)}
                    className="lg:hidden grid place-items-center w-10 h-10 rounded-lg hover:bg-hover transition-colors duration-150"
                    aria-label={t('parentMessages.back')}
                  >
                    <ArrowLeft className="w-5 h-5 text-text-primary rtl:rotate-180" />
                  </button>
                  <RecipientAvatar conversation={activeConversation} />
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-text-heading truncate">{recipientName(activeConversation)}</p>
                    <p className="text-caption text-text-secondary truncate">{recipientRole(activeConversation)}</p>
                  </div>
                </div>

                {/* Messages area — forced LTR structure so sent messages always
                    align right regardless of interface language (Messenger-style);
                    each bubble's own text still gets its natural direction via dir="auto". */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-page" dir="ltr">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn('animate-pulse h-10 rounded-2xl bg-subtle', i % 2 === 0 ? 'w-2/3 ms-auto' : 'w-2/3')}
                        />
                      ))}
                    </div>
                  ) : messages.length === 0 && pendingMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-body text-text-secondary">{t('parentMessages.noMessages')}</p>
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

                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('parentMessages.placeholder')}
                      rows={1}
                      className="flex-1 min-h-[44px] max-h-[120px] bg-subtle border border-border rounded-xl px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-none"
                      aria-label={t('parentMessages.inputLabel')}
                    />

                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className={cn(
                        'flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl transition-all duration-150 active:scale-[0.98]',
                        messageInput.trim()
                          ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
                          : 'bg-subtle text-text-disabled cursor-not-allowed'
                      )}
                      aria-label={t('parentMessages.send')}
                    >
                      <Send className="w-5 h-5 rtl:-scale-x-100" />
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

      <NewMessageDialog
        open={showNewMessage}
        onOpenChange={setShowNewMessage}
        conversations={conversations}
        onOpened={(id) => {
          setActiveConversationId(id);
          setShowNewMessage(false);
        }}
      />
    </div>
  );
}

/**
 * Who to write to: the school office, or one of the children's teachers.
 * An existing conversation with that person opens instead of a new one.
 */
function NewMessageDialog({
  open,
  onOpenChange,
  conversations,
  onOpened,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onOpened: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: contacts = [], isLoading } = useMessageContacts(open);
  const createConversation = useCreateConversation();

  // Each teacher once, with the children they teach.
  const teachers = React.useMemo(() => {
    const byTeacher = new Map<string, { id: string; name: string; childIds: string[]; childNames: string[] }>();
    contacts.forEach((c) => {
      if (!c.teacherUserId || !c.teacherName) return;
      const entry = byTeacher.get(c.teacherUserId) ?? { id: c.teacherUserId, name: c.teacherName, childIds: [], childNames: [] };
      entry.childIds.push(c.childId);
      entry.childNames.push(c.firstName);
      byTeacher.set(c.teacherUserId, entry);
    });
    return [...byTeacher.values()];
  }, [contacts]);

  const open_ = (existing: Conversation | undefined, childId: string | undefined, withOffice: boolean) => {
    if (existing) {
      onOpened(existing.id);
      return;
    }
    if (!childId) return;
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

  const rowClass =
    'w-full flex items-center gap-3 p-3 rounded-xl border border-border text-start hover:bg-hover hover:border-[var(--color-border-strong)] active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('parentMessages.newMessage')}</DialogTitle>
          <DialogDescription>{t('parentMessages.newMessageHint')}</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <div key={i} className="animate-pulse h-16 bg-subtle rounded-xl" />)
          ) : contacts.length === 0 ? (
            <p className="text-body text-text-secondary text-center py-4">{t('parentMessages.noChildren')}</p>
          ) : (
            <>
              {teachers.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  disabled={createConversation.isPending}
                  onClick={() =>
                    open_(
                      conversations.find((c) => !c.with_office && c.teacher_user_id === teacher.id),
                      teacher.childIds[0],
                      false,
                    )
                  }
                  className={rowClass}
                >
                  <Avatar name={teacher.name} size="md" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-body font-semibold text-text-heading truncate">{teacher.name}</span>
                    <span className="block text-caption text-text-secondary truncate">
                      {t('parentMessages.teacherOf', { names: teacher.childNames.join(', ') })}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-text-disabled rtl:rotate-180" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                disabled={createConversation.isPending}
                onClick={() => open_(conversations.find((c) => c.with_office), contacts[0]?.childId, true)}
                className={rowClass}
              >
                <span className="shrink-0 grid place-items-center w-10 h-10 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent-ink)]">
                  <Building2 className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-body font-semibold text-text-heading">{t('parentMessages.office')}</span>
                  <span className="block text-caption text-text-secondary truncate">{t('parentMessages.officeHint')}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-text-disabled rtl:rotate-180" aria-hidden="true" />
              </button>
            </>
          )}
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
