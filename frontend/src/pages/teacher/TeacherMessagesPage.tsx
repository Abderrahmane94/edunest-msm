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
  type Conversation,
} from '@/hooks/useMessaging';

export function TeacherMessagesPage() {
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

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();

  // Fetch messages for active conversation
  const { data: messages = [], isLoading: messagesLoading } = useMessages(
    activeConversationId ?? undefined
  );

  // Mutations
  const sendMessage = useSendMessage(activeConversationId ?? undefined);
  const sendFileMessage = useSendFileMessage(activeConversationId ?? undefined);
  const markRead = useMarkMessageRead();

  // Get active conversation details
  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

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
        // Mark as read if it's from the other party
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

  // Handle sending a text message
  const handleSendMessage = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;

    sendMessage.mutate({ content: trimmed, message_type: 'text' });
    setMessageInput('');
  }, [messageInput, activeConversationId, sendMessage]);

  // Handle keyboard submit
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Handle file attachment
  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, messageType: 'photo' | 'document') => {
      const file = e.target.files?.[0];
      if (!file || !activeConversationId) return;

      sendFileMessage.mutate({ file, messageType });
      setShowAttachMenu(false);

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [activeConversationId, sendFileMessage]
  );

  // Select a conversation
  const handleSelectConversation = React.useCallback((conversation: Conversation) => {
    setActiveConversationId(conversation.id);
  }, []);

  // Go back to conversation list (mobile)
  const handleBack = React.useCallback(() => {
    setActiveConversationId(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-page">
      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={showNewConversationDialog}
        onOpenChange={setShowNewConversationDialog}
        onConversationCreated={(conversationId) => {
          setActiveConversationId(conversationId);
          setShowNewConversationDialog(false);
        }}
      />

      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-subsection font-semibold text-text-heading">
            {t('messages.title', 'Messages')}
          </h1>
          <button
            type="button"
            onClick={() => setShowNewConversationDialog(true)}
            className="flex items-center justify-center min-w-[36px] min-h-[36px] rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-all duration-150 active:scale-[0.98]"
            aria-label={t('messages.newConversation', 'New conversation')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content: 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list (left panel) */}
        <aside
          className={cn(
            'w-full lg:w-80 lg:shrink-0 border-e border-border bg-card overflow-y-auto',
            activeConversationId ? 'hidden lg:block' : 'block'
          )}
        >
          {conversationsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
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
            <div className="flex items-center justify-center h-full p-4">
              <p className="text-body text-text-secondary text-center">
                {t('messages.noConversations', 'No conversations yet')}
              </p>
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
                    <Avatar
                      name={conversation.parent_name}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body font-medium text-text-primary truncate">
                          {conversation.parent_name}
                        </span>
                        {conversation.unread_count > 0 && (
                          <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-text-secondary truncate mt-0.5">
                        {conversation.child_name}
                      </p>
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

        {/* Chat area (right panel) */}
        <main
          className={cn(
            'flex-1 flex flex-col min-w-0',
            !activeConversationId ? 'hidden lg:flex' : 'flex'
          )}
        >
          {!activeConversationId ? (
            /* Empty state when no conversation selected */
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-body text-text-secondary">
                {t('messages.selectConversation', 'Select a conversation to start messaging')}
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
                <button
                  type="button"
                  onClick={handleBack}
                  className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-hover transition-colors duration-150"
                  aria-label={t('messages.back', 'Back')}
                >
                  <ArrowLeft className="w-5 h-5 text-text-primary rtl:rotate-180" />
                </button>
                <Avatar
                  name={activeConversation?.parent_name}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-body font-medium text-text-primary truncate">
                    {activeConversation?.parent_name}
                  </p>
                  <p className="text-caption text-text-secondary truncate">
                    {activeConversation?.child_name}
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
                      {t('messages.noMessages', 'No messages yet. Start the conversation!')}
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isSent={message.sender_user_id === user?.id}
                      i18nNamespace="messages"
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
                      aria-label={t('messages.attach', 'Attach file')}
                      aria-expanded={showAttachMenu}
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    {/* Attachment menu */}
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

                  {/* Text input */}
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('messages.placeholder', 'Type a message...')}
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-[120px] bg-subtle border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-none"
                    aria-label={t('messages.inputLabel', 'Message input')}
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
                    aria-label={t('messages.send', 'Send message')}
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

/**
 * Dialog for creating a new conversation by selecting a child
 */
function NewConversationDialog({
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
            const conversation = (data as { conversation?: { id: string } })?.conversation ?? data;
            const id = (conversation as { id: string })?.id;
            if (id) {
              onConversationCreated(id);
            } else {
              onOpenChange(false);
            }
          },
        }
      );
    },
    [createConversation, onConversationCreated, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('messages.newConversation', 'New conversation')}
          </DialogTitle>
          <DialogDescription>
            {t('messages.selectChildForConversation', 'Select a child to start a conversation with their parent')}
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
                <Avatar
                  src={child.photo_url}
                  name={`${child.first_name} ${child.last_name}`}
                  size="sm"
                />
                <span className="text-body font-medium text-text-primary">
                  {child.first_name} {child.last_name}
                </span>
              </button>
            ))
          ) : (
            <p className="text-body text-text-secondary text-center py-4">
              {t('messages.noChildrenAvailable', 'No children available')}
            </p>
          )}
          {createConversation.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {createConversation.error?.message || t('messages.createError', 'Failed to create conversation')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

