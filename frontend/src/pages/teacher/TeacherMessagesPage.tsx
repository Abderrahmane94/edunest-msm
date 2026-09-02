import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
import { Avatar, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useTeacherClassroom, useClassroomChildren } from '@/hooks/useTeacherClassroom';
import {
  useConversations,
  useMessages,
  useSendMessage,
  useSendFileMessage,
  useMarkMessageRead,
  useCreateConversation,
} from '@/hooks/useMessaging';
import {
  useStaffConversations,
  useStaffMessages,
  useSendStaffMessage,
  useSendStaffFileMessage,
  useMarkStaffMessageRead,
  useGetOrCreateStaffConversation,
  useStaffColleagues,
  type StaffConversation,
  type StaffMessage,
} from '@/hooks/useStaffMessaging';

// ─── Tab type ────────────────────────────────────────────────────────────────

type TabMode = 'parents' | 'staff';

// ─── Main page ───────────────────────────────────────────────────────────────

export function TeacherMessagesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<TabMode>('parents');

  return (
    <div className="h-screen flex flex-col bg-page">
      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-3">
        <h1 className="text-subsection font-semibold text-text-heading">
          {t('messages.title', 'Messages')}
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
            {t('messages.tabParents', 'Parents')}
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
            {t('messages.tabColleagues', 'Collègues')}
          </button>
        </div>
      </header>

      {/* Tab content */}
      {tab === 'parents' ? <ParentMessagingPanel /> : <StaffMessagingPanel />}
    </div>
  );
}

// ─── Parent messaging panel (existing logic, extracted) ──────────────────────

function ParentMessagingPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeConversationId ?? undefined);

  const sendMessage = useSendMessage(activeConversationId ?? undefined);
  const sendFileMessage = useSendFileMessage(activeConversationId ?? undefined);
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
  }, [messages]);

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

  const handleSendMessage = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;
    sendMessage.mutate({ content: trimmed, message_type: 'text' });
    setMessageInput('');
  }, [messageInput, activeConversationId, sendMessage]);

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
      sendFileMessage.mutate({ file, messageType });
      setShowAttachMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [activeConversationId, sendFileMessage]
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
            {t('messages.parentConversations', 'Conversations parents')}
          </span>
          <button
            type="button"
            onClick={() => setShowNewConversationDialog(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-all duration-150"
            aria-label={t('messages.newConversation', 'Nouvelle conversation')}
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
              {t('messages.noConversations', 'Aucune conversation')}
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {conversations.map((conv) => (
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
                      <p className="text-caption text-text-secondary truncate mt-0.5">{conv.last_message}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Chat area */}
      <main className={cn('flex-1 flex flex-col min-w-0', !activeConversationId ? 'hidden lg:flex' : 'flex')}>
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-body text-text-secondary">
              {t('messages.selectConversation', 'Sélectionnez une conversation')}
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
                  aria-label={t('messages.back', 'Retour')}
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
            sendPending={sendMessage.isPending}
            userId={user?.id}
            messagesEndRef={messagesEndRef}
            attachMenuRef={attachMenuRef}
            showAttachMenu={showAttachMenu}
            setShowAttachMenu={setShowAttachMenu}
            fileInputRef={fileInputRef}
            photoInputRef={photoInputRef}
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

function StaffMessagingPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useStaffConversations();
  const { data: messages = [], isLoading: messagesLoading } = useStaffMessages(activeConversationId ?? undefined);

  const sendMessage = useSendStaffMessage(activeConversationId ?? undefined);
  const sendFileMessage = useSendStaffFileMessage(activeConversationId ?? undefined);
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
  }, [messages]);

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

  const handleSendMessage = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;
    sendMessage.mutate({ content: trimmed, message_type: 'text' });
    setMessageInput('');
  }, [messageInput, activeConversationId, sendMessage]);

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
      sendFileMessage.mutate({ file, messageType });
      setShowAttachMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [activeConversationId, sendFileMessage]
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
            {t('messages.staffConversations', 'Collègues')}
          </span>
          <button
            type="button"
            onClick={() => setShowNewDialog(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-all duration-150"
            aria-label={t('messages.newStaffConversation', 'Nouvelle conversation')}
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
              {t('messages.noStaffConversations', 'Aucune conversation avec un collègue')}
            </p>
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="text-caption text-[var(--color-accent)] hover:underline"
            >
              {t('messages.startNewStaffConversation', 'Commencer une conversation')}
            </button>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {conversations.map((conv) => {
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
                          ? t('messages.roleAdmin', 'Directeur')
                          : t('messages.roleTeacher', 'Enseignant')}
                      </p>
                      {conv.last_message && (
                        <p className="text-caption text-text-secondary truncate mt-0.5">{conv.last_message}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Chat area */}
      <main className={cn('flex-1 flex flex-col min-w-0', !activeConversationId ? 'hidden lg:flex' : 'flex')}>
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-body text-text-secondary">
              {t('messages.selectConversation', 'Sélectionnez une conversation')}
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
                  aria-label={t('messages.back', 'Retour')}
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
                      ? t('messages.roleAdmin', 'Directeur')
                      : t('messages.roleTeacher', 'Enseignant')}
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
            sendPending={sendMessage.isPending}
            userId={user?.id}
            messagesEndRef={messagesEndRef}
            attachMenuRef={attachMenuRef}
            showAttachMenu={showAttachMenu}
            setShowAttachMenu={setShowAttachMenu}
            fileInputRef={fileInputRef}
            photoInputRef={photoInputRef}
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
  sendPending: boolean;
  userId?: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  attachMenuRef: React.RefObject<HTMLDivElement>;
  showAttachMenu: boolean;
  setShowAttachMenu: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  photoInputRef: React.RefObject<HTMLInputElement>;
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
  sendPending,
  userId,
  messagesEndRef,
  attachMenuRef,
  showAttachMenu,
  setShowAttachMenu,
  fileInputRef,
  photoInputRef,
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
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-body text-text-secondary">
              {t('messages.noMessages', 'Aucun message. Commencez la conversation !')}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSent={message.sender_user_id === userId}
              i18nNamespace={i18nNamespace}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="shrink-0 bg-card border-t border-border p-3">
        <div className="flex items-end gap-2">
          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-hover text-text-secondary hover:text-text-primary transition-colors duration-150"
              aria-label={t('messages.attach', 'Joindre un fichier')}
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
                  {t('messages.sendPhoto', 'Photo')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors duration-150"
                >
                  <FileText className="w-4 h-4 text-text-secondary" />
                  {t('messages.sendDocument', 'Document')}
                </button>
              </div>
            )}
          </div>

          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('messages.placeholder', 'Écrivez un message...')}
            rows={1}
            className="flex-1 min-h-[44px] max-h-[120px] bg-subtle border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-none"
            aria-label={t('messages.inputLabel', 'Zone de saisie du message')}
          />

          <button
            type="button"
            onClick={onSend}
            disabled={!messageInput.trim() || sendPending}
            className={cn(
              'flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all duration-150 active:scale-[0.98]',
              messageInput.trim()
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
                : 'bg-subtle text-text-disabled cursor-not-allowed'
            )}
            aria-label={t('messages.send', 'Envoyer')}
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
          <DialogTitle>{t('messages.newConversation', 'Nouvelle conversation')}</DialogTitle>
          <DialogDescription>
            {t('messages.selectChildForConversation', 'Sélectionnez un enfant pour démarrer une conversation avec son parent')}
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
              {t('messages.noChildrenAvailable', 'Aucun enfant disponible')}
            </p>
          )}
          {createConversation.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {createConversation.error?.message || t('messages.createError', 'Échec de la création')}
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
          <DialogTitle>{t('messages.newStaffConversationTitle', 'Nouvelle conversation')}</DialogTitle>
          <DialogDescription>
            {t('messages.selectColleague', 'Sélectionnez un collègue pour démarrer une conversation')}
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
                      ? t('messages.roleAdmin', 'Directeur')
                      : t('messages.roleTeacher', 'Enseignant')}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-body text-text-secondary text-center py-4">
              {t('messages.noColleagues', 'Aucun collègue trouvé')}
            </p>
          )}
          {getOrCreate.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {getOrCreate.error?.message || t('messages.createError', 'Échec de la création')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
