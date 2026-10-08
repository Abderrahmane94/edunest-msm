import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useChatSend } from '@/components/messaging/useChatSend';
import { errorMessage } from '@/lib/errorMessage';
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
  Plus,
  Users,
  Baby,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, SearchInput } from '@/components/ui';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { PendingMessageBubble } from '@/components/messaging/PendingMessageBubble';
import { sendTextMessage, usePendingMessages, type MessagePayload } from '@/hooks/useMessageSync';
import type { QueuedAction } from '@/lib/offlineQueue';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useTeacherClassroom, useClassroomChildren } from '@/hooks/useTeacherClassroom';
import {
  useConversations,
  useMessages,
  useSendFileMessage,
  useMarkMessageRead,
  useCreateConversation,
} from '@/hooks/useMessaging';
import {
  useStaffConversations,
  useStaffMessages,
  useSendStaffFileMessage,
  useMarkStaffMessageRead,
  useGetOrCreateStaffConversation,
  useStaffColleagues,
  type StaffConversation,
  type StaffMessage,
} from '@/hooks/useStaffMessaging';
import { messagePreview } from '@/components/messaging/messagePreview';

// ─── Tab type ────────────────────────────────────────────────────────────────

type TabMode = 'parents' | 'staff';

// ─── Main page ───────────────────────────────────────────────────────────────

export function TeacherMessagesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: TabMode = tabParam === 'staff' ? 'staff' : 'parents';
  const conversationId = searchParams.get('conversationId') ?? undefined;
  const [tab, setTab] = React.useState<TabMode>(initialTab);

  // Re-sync when navigating here again (e.g. from another notification)
  // while this page is already mounted.
  React.useEffect(() => {
    if (tabParam === 'staff' || tabParam === 'parents') {
      setTab(tabParam);
    }
  }, [tabParam]);

  return (
    // Fills the screen below the layout's top bar and page padding (and above
    // the bottom tab bar below lg), so the message box stays in view.
    <div className="h-[calc(100dvh-6rem-var(--tabbar-h))] sm:h-[calc(100dvh-7rem-var(--tabbar-h))] lg:h-[calc(100dvh-6.5rem)] min-h-[420px] flex flex-col bg-page border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-3">
        <h1 className="text-subsection font-semibold text-text-heading">
          {t('messages.title')}
        </h1>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 mt-2">
          <button
            type="button"
            onClick={() => setTab('parents')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium transition-colors duration-150',
              tab === 'parents'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'text-text-secondary hover:bg-hover'
            )}
          >
            <Baby className="w-3.5 h-3.5" />
            {t('messages.tabParents')}
          </button>
          <button
            type="button"
            onClick={() => setTab('staff')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium transition-colors duration-150',
              tab === 'staff'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'text-text-secondary hover:bg-hover'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            {t('messages.tabColleagues')}
          </button>
        </div>
      </header>

      {/* Tab content */}
      {tab === 'parents' ? (
        <ParentMessagingPanel key={conversationId ?? 'parents-default'} initialConversationId={conversationId} />
      ) : (
        <StaffMessagingPanel key={conversationId ?? 'staff-default'} initialConversationId={conversationId} />
      )}
    </div>
  );
}

// ─── Parent messaging panel (existing logic, extracted) ──────────────────────

function ParentMessagingPanel({ initialConversationId }: { initialConversationId?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(
    initialConversationId ?? null,
  );
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const [search, setSearch] = React.useState('');
  const shownConversations = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => [c.parent_name, c.child_name].some((v) => (v ?? '').toLowerCase().includes(needle)));
  }, [conversations, search]);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeConversationId ?? undefined);

  const { pending: pendingMessages, syncing } = usePendingMessages('parent', activeConversationId);
  const sendFileMessage = useSendFileMessage(activeConversationId ?? undefined);
  const chatSend = useChatSend();
  const markRead = useMarkMessageRead();

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  React.useEffect(() => {
    if (activeConversationId) {
      joinRoom(`conversation:${activeConversationId}`);
      return () => leaveRoom(`conversation:${activeConversationId}`);
    }
  }, [activeConversationId, joinRoom, leaveRoom]);

  React.useEffect(() => {
    const unsubNew = on('message:new', (data: unknown) => {
      const msg = data as { conversationId: string; senderUserId: string; id: string };
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (msg.conversationId === activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
        if (msg.senderUserId !== user?.id) markRead.mutate(msg.id);
      }
    });
    const unsubRead = on('message:read', () => {
      if (activeConversationId)
        queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
    });
    return () => { unsubNew(); unsubRead(); };
  }, [on, activeConversationId, user?.id, markRead, queryClient]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMessages.length]);

  const markedReadRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const unread = messages.filter(
        (m) => !m.is_read && m.sender_user_id !== user.id && !markedReadRef.current.has(m.id)
      );
      unread.forEach((m) => { markedReadRef.current.add(m.id); markRead.mutate(m.id); });
    }
  }, [messages, user?.id, markRead]);

  React.useEffect(() => { markedReadRef.current.clear(); }, [activeConversationId]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node))
        setShowAttachMenu(false);
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
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
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

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Conversation list */}
      <aside className={cn(
        'w-full lg:w-80 lg:shrink-0 border-e border-border bg-card overflow-y-auto',
        activeConversationId ? 'hidden lg:block' : 'block'
      )}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-caption text-text-secondary font-medium">
            {t('messages.parentConversations')}
          </span>
          <button
            type="button"
            onClick={() => setShowNewConversationDialog(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-all duration-150"
            aria-label={t('messages.newConversation')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {conversationsLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-subtle" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-subtle rounded w-3/4" />
                  <div className="h-3 bg-subtle rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32 p-4">
            <p className="text-body text-text-secondary text-center">
              {t('messages.noConversations')}
            </p>
          </div>
        ) : (
          <>
          <div className="p-3 border-b border-border">
            <SearchInput onSearch={setSearch} placeholder={t('messages.searchParents')} defaultValue={search} />
          </div>
          {shownConversations.length === 0 && (
            <p className="p-4 text-body text-text-secondary text-center">{t('messages.noMatch')}</p>
          )}
          <ul role="list" className="divide-y divide-border">
            {shownConversations.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => setActiveConversationId(conv.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-4 text-start transition-colors duration-150',
                    activeConversationId === conv.id ? 'bg-[var(--color-accent-muted)]' : 'hover:bg-hover'
                  )}
                >
                  <Avatar name={conv.parent_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body font-medium text-text-primary truncate">{conv.parent_name}</span>
                      {conv.unread_count > 0 && (
                        <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-caption text-text-secondary truncate mt-0.5">{conv.child_name}</p>
                    {conv.last_message && (
                      <p className="text-caption text-text-secondary truncate mt-0.5">{messagePreview(conv.last_message, t)}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </aside>

      {/* Chat area */}
      <main className={cn('flex-1 flex flex-col min-w-0', !activeConversationId ? 'hidden lg:flex' : 'flex')}>
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-body text-text-secondary">
              {t('messages.selectConversation')}
            </p>
          </div>
        ) : (
          <ChatArea
            header={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveConversationId(null)}
                  className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-hover transition-colors duration-150"
                  aria-label={t('messages.back')}
                >
                  <ArrowLeft className="w-5 h-5 text-text-primary rtl:rotate-180" />
                </button>
                <Avatar name={activeConversation?.parent_name} size="md" />
                <div className="min-w-0">
                  <p className="text-body font-medium text-text-primary truncate">{activeConversation?.parent_name}</p>
                  <p className="text-caption text-text-secondary truncate">{activeConversation?.child_name}</p>
                </div>
              </div>
            }
            messages={messages}
            messagesLoading={messagesLoading}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            onSend={handleSendMessage}
            onKeyDown={handleKeyDown}
            onFileSelect={handleFileSelect}
            pendingMessages={pendingMessages}
            syncing={syncing}
            userId={user?.id}
            messagesEndRef={messagesEndRef}
            attachMenuRef={attachMenuRef}
            showAttachMenu={showAttachMenu}
            setShowAttachMenu={setShowAttachMenu}
            fileInputRef={fileInputRef}
            photoInputRef={photoInputRef}
            sendError={chatSend.error}
            onDismissSendError={chatSend.clearError}
            i18nNamespace="messages"
          />
        )}
      </main>

      {/* New conversation dialog */}
      <NewParentConversationDialog
        open={showNewConversationDialog}
        onOpenChange={setShowNewConversationDialog}
        onConversationCreated={(id) => {
          setActiveConversationId(id);
          setShowNewConversationDialog(false);
        }}
      />
    </div>
  );
}

// ─── Staff messaging panel ────────────────────────────────────────────────────

function StaffMessagingPanel({ initialConversationId }: { initialConversationId?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(
    initialConversationId ?? null,
  );
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useStaffConversations();
  const [search, setSearch] = React.useState('');
  const { data: messages = [], isLoading: messagesLoading } = useStaffMessages(activeConversationId ?? undefined);

  const { pending: pendingMessages, syncing } = usePendingMessages('staff', activeConversationId);
  const sendFileMessage = useSendStaffFileMessage(activeConversationId ?? undefined);
  const chatSend = useChatSend();
  const markRead = useMarkStaffMessageRead();

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  // Determine the other participant's name for display
  const getOtherParticipant = React.useCallback(
    (conv: StaffConversation) =>
      conv.initiator_id === user?.id ? conv.recipient : conv.initiator,
    [user?.id]
  );

  const activeOther = activeConversation ? getOtherParticipant(activeConversation) : null;

  const shownConversations = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const other = getOtherParticipant(c);
      return `${other.firstName} ${other.lastName}`.toLowerCase().includes(needle);
    });
  }, [conversations, search, getOtherParticipant]);

  // Socket room
  React.useEffect(() => {
    if (activeConversationId) {
      joinRoom(`staff_conversation:${activeConversationId}`);
      return () => leaveRoom(`staff_conversation:${activeConversationId}`);
    }
  }, [activeConversationId, joinRoom, leaveRoom]);

  // Real-time events
  React.useEffect(() => {
    const unsubNew = on('staff_message:new', (data: unknown) => {
      const msg = data as { conversationId: string; senderUserId: string; id: string };
      queryClient.invalidateQueries({ queryKey: ['staff-conversations'] });
      if (msg.conversationId === activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['staff-messages', activeConversationId] });
        if (msg.senderUserId !== user?.id) markRead.mutate(msg.id);
      }
    });
    const unsubRead = on('staff_message:read', () => {
      if (activeConversationId)
        queryClient.invalidateQueries({ queryKey: ['staff-messages', activeConversationId] });
    });
    return () => { unsubNew(); unsubRead(); };
  }, [on, activeConversationId, user?.id, markRead, queryClient]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMessages.length]);

  // Auto mark as read
  const markedReadRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const unread = messages.filter(
        (m: StaffMessage) => !m.is_read && m.sender_user_id !== user.id && !markedReadRef.current.has(m.id)
      );
      unread.forEach((m: StaffMessage) => { markedReadRef.current.add(m.id); markRead.mutate(m.id); });
    }
  }, [messages, user?.id, markRead]);

  React.useEffect(() => { markedReadRef.current.clear(); }, [activeConversationId]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node))
        setShowAttachMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sent right away, or kept on the device until the connection returns.
  const handleSendMessage = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;
    void sendTextMessage('staff', activeConversationId, trimmed);
    setMessageInput('');
  }, [messageInput, activeConversationId]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
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

  // Convert StaffMessage to the shape MessageBubble expects
  const adaptedMessages = React.useMemo(
    () =>
      messages.map((m: StaffMessage) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_user_id: m.sender_user_id,
        content: m.content,
        message_type: m.message_type,
        cloudinary_public_id: m.cloudinary_public_id,
        file_url: m.file_url,
        is_read: m.is_read,
        created_at: m.created_at,
      })),
    [messages]
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Conversation list */}
      <aside className={cn(
        'w-full lg:w-80 lg:shrink-0 border-e border-border bg-card overflow-y-auto',
        activeConversationId ? 'hidden lg:block' : 'block'
      )}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-caption text-text-secondary font-medium">
            {t('messages.staffConversations')}
          </span>
          <button
            type="button"
            onClick={() => setShowNewDialog(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-all duration-150"
            aria-label={t('messages.newStaffConversation')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {conversationsLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-subtle" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-subtle rounded w-3/4" />
                  <div className="h-3 bg-subtle rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 p-4 gap-2">
            <p className="text-body text-text-secondary text-center">
              {t('messages.noStaffConversations')}
            </p>
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="text-caption text-[var(--color-accent)] hover:underline"
            >
              {t('messages.startNewStaffConversation')}
            </button>
          </div>
        ) : (
          <>
          <div className="p-3 border-b border-border">
            <SearchInput onSearch={setSearch} placeholder={t('messages.searchStaff')} defaultValue={search} />
          </div>
          {shownConversations.length === 0 && (
            <p className="p-4 text-body text-text-secondary text-center">{t('messages.noMatch')}</p>
          )}
          <ul role="list" className="divide-y divide-border">
            {shownConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const fullName = `${other.firstName} ${other.lastName}`;
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => setActiveConversationId(conv.id)}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 text-start transition-colors duration-150',
                      activeConversationId === conv.id ? 'bg-[var(--color-accent-muted)]' : 'hover:bg-hover'
                    )}
                  >
                    <Avatar name={fullName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body font-medium text-text-primary truncate">{fullName}</span>
                        {conv.unread_count > 0 && (
                          <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-text-secondary truncate mt-0.5">
                        {other.role === 'admin'
                          ? t('messages.roleAdmin')
                          : t('messages.roleTeacher')}
                      </p>
                      {conv.last_message && (
                        <p className="text-caption text-text-secondary truncate mt-0.5">{messagePreview(conv.last_message, t)}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </aside>

      {/* Chat area */}
      <main className={cn('flex-1 flex flex-col min-w-0', !activeConversationId ? 'hidden lg:flex' : 'flex')}>
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-body text-text-secondary">
              {t('messages.selectConversation')}
            </p>
          </div>
        ) : (
          <ChatArea
            header={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveConversationId(null)}
                  className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-hover transition-colors duration-150"
                  aria-label={t('messages.back')}
                >
                  <ArrowLeft className="w-5 h-5 text-text-primary rtl:rotate-180" />
                </button>
                <Avatar
                  name={activeOther ? `${activeOther.firstName} ${activeOther.lastName}` : ''}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-body font-medium text-text-primary truncate">
                    {activeOther ? `${activeOther.firstName} ${activeOther.lastName}` : ''}
                  </p>
                  <p className="text-caption text-text-secondary truncate">
                    {activeOther?.role === 'admin'
                      ? t('messages.roleAdmin')
                      : t('messages.roleTeacher')}
                  </p>
                </div>
              </div>
            }
            messages={adaptedMessages}
            messagesLoading={messagesLoading}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            onSend={handleSendMessage}
            onKeyDown={handleKeyDown}
            onFileSelect={handleFileSelect}
            pendingMessages={pendingMessages}
            syncing={syncing}
            userId={user?.id}
            messagesEndRef={messagesEndRef}
            attachMenuRef={attachMenuRef}
            showAttachMenu={showAttachMenu}
            setShowAttachMenu={setShowAttachMenu}
            fileInputRef={fileInputRef}
            photoInputRef={photoInputRef}
            sendError={chatSend.error}
            onDismissSendError={chatSend.clearError}
            i18nNamespace="messages"
          />
        )}
      </main>

      {/* New staff conversation dialog */}
      <NewStaffConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          setActiveConversationId(id);
          setShowNewDialog(false);
        }}
      />
    </div>
  );
}

// ─── Shared ChatArea component ────────────────────────────────────────────────

interface ChatAreaProps {
  header: React.ReactNode;
  messages: Array<{
    id: string;
    conversation_id: string;
    sender_user_id: string;
    content: string | null;
    message_type: 'text' | 'photo' | 'document';
    cloudinary_public_id?: string;
    file_url?: string;
    is_read: boolean;
    created_at: string;
  }>;
  messagesLoading: boolean;
  messageInput: string;
  setMessageInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'document') => void;
  /** Messages written here not sent yet (offline, or refused). */
  pendingMessages: QueuedAction<MessagePayload>[];
  syncing: boolean;
  userId?: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  attachMenuRef: React.RefObject<HTMLDivElement>;
  showAttachMenu: boolean;
  setShowAttachMenu: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  photoInputRef: React.RefObject<HTMLInputElement>;
  /** Why the last send failed, shown above the input. */
  sendError: string | null;
  onDismissSendError: () => void;
  i18nNamespace: string;
}

function ChatArea({
  header,
  messages,
  messagesLoading,
  messageInput,
  setMessageInput,
  onSend,
  onKeyDown,
  onFileSelect,
  pendingMessages,
  syncing,
  userId,
  messagesEndRef,
  attachMenuRef,
  showAttachMenu,
  setShowAttachMenu,
  fileInputRef,
  photoInputRef,
  sendError,
  onDismissSendError,
  i18nNamespace,
}: ChatAreaProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Chat header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        {header}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="ltr">
        {messagesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('animate-pulse h-10 rounded-2xl bg-subtle', i % 2 === 0 ? 'w-2/3 ms-auto' : 'w-2/3')} />
            ))}
          </div>
        ) : messages.length === 0 && pendingMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-body text-text-secondary">
              {t('messages.noMessages')}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isSent={message.sender_user_id === userId}
                i18nNamespace={i18nNamespace}
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
        <ErrorAlert message={sendError} onDismiss={onDismissSendError} className="mb-2" />
        <div className="flex items-end gap-2">
          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-hover text-text-secondary hover:text-text-primary transition-colors duration-150"
              aria-label={t('messages.attach')}
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
                  {t('messages.sendPhoto')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors duration-150"
                >
                  <FileText className="w-4 h-4 text-text-secondary" />
                  {t('messages.sendDocument')}
                </button>
              </div>
            )}
          </div>

          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('messages.placeholder')}
            rows={1}
            className="flex-1 min-h-[44px] max-h-[120px] bg-subtle border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-none"
            aria-label={t('messages.inputLabel')}
          />

          <button
            type="button"
            onClick={onSend}
            disabled={!messageInput.trim()}
            className={cn(
              'flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all duration-150 active:scale-[0.98]',
              messageInput.trim()
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
                : 'bg-subtle text-text-disabled cursor-not-allowed'
            )}
            aria-label={t('messages.send')}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" onChange={(e) => onFileSelect(e, 'photo')} className="hidden" aria-hidden="true" />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => onFileSelect(e, 'document')} className="hidden" aria-hidden="true" />
    </>
  );
}

// ─── Dialog: new parent conversation ─────────────────────────────────────────

function NewParentConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: classroom } = useTeacherClassroom();
  const { data: children, isLoading: childrenLoading } = useClassroomChildren(classroom?.id);
  const createConversation = useCreateConversation();

  const handleSelectChild = React.useCallback(
    (childId: string) => {
      createConversation.mutate(
        { childId },
        {
          onSuccess: (data) => {
            const conv = (data as { conversation?: { id: string } })?.conversation ?? data;
            const id = (conv as { id: string })?.id;
            if (id) onConversationCreated(id);
            else onOpenChange(false);
          },
        },
      );
    },
    [createConversation, onConversationCreated, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('messages.newConversation')}</DialogTitle>
          <DialogDescription>
            {t('messages.selectChildForConversation')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {childrenLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-subtle rounded-lg" />
              ))}
            </div>
          ) : children && children.length > 0 ? (
            children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => handleSelectChild(child.id)}
                disabled={createConversation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-hover hover:border-[var(--color-border-strong)] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Avatar src={child.photo_url} name={`${child.first_name} ${child.last_name}`} size="sm" />
                <span className="text-body font-medium text-text-primary">
                  {child.first_name} {child.last_name}
                </span>
              </button>
            ))
          ) : (
            <p className="text-body text-text-secondary text-center py-4">
              {t('messages.noChildrenAvailable')}
            </p>
          )}
          {createConversation.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {errorMessage(createConversation.error, t)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: new staff conversation ──────────────────────────────────────────

function NewStaffConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: colleagues = [], isLoading } = useStaffColleagues();
  const getOrCreate = useGetOrCreateStaffConversation();

  const handleSelect = React.useCallback(
    (colleagueId: string) => {
      getOrCreate.mutate(colleagueId, {
        onSuccess: (conv) => {
          onConversationCreated(conv.id);
        },
      });
    },
    [getOrCreate, onConversationCreated],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('messages.newStaffConversationTitle')}</DialogTitle>
          <DialogDescription>
            {t('messages.selectColleague')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-subtle rounded-lg" />
              ))}
            </div>
          ) : colleagues.length > 0 ? (
            colleagues.map((colleague) => (
              <button
                key={colleague.id}
                type="button"
                onClick={() => handleSelect(colleague.id)}
                disabled={getOrCreate.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-hover hover:border-[var(--color-border-strong)] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Avatar name={`${colleague.firstName} ${colleague.lastName}`} size="sm" />
                <div className="text-start">
                  <p className="text-body font-medium text-text-primary">
                    {colleague.firstName} {colleague.lastName}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {colleague.role === 'admin'
                      ? t('messages.roleAdmin')
                      : t('messages.roleTeacher')}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-body text-text-secondary text-center py-4">
              {t('messages.noColleagues')}
            </p>
          )}
          {getOrCreate.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {errorMessage(getOrCreate.error, t)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
