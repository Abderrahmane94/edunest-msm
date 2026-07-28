import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, FileText, CheckCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/hooks/useMessaging';

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  /** Translation namespace the caller's locale keys live under (e.g. 'messages', 'parentMessages'). */
  i18nNamespace: string;
}

export function MessageBubble({ message, isSent, i18nNamespace }: MessageBubbleProps) {
  const { t } = useTranslation();
  const tn = (key: string, defaultValue: string) => t(`${i18nNamespace}.${key}`, defaultValue);

  const formattedTime = React.useMemo(() => {
    const date = new Date(message.created_at);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [message.created_at]);

  return (
    <div
      className={cn('flex flex-col max-w-[75%]', isSent ? 'ms-auto items-end' : 'items-start')}
    >
      <div
        className={cn(
          'px-3.5 py-2.5 text-body',
          isSent
            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-2xl rounded-ee-sm'
            : 'bg-subtle text-text-primary rounded-2xl rounded-es-sm'
        )}
      >
        {message.message_type === 'text' && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {message.message_type === 'photo' && (
          <div className="space-y-1">
            {message.file_url && (
              <img
                src={message.file_url}
                alt={tn('photoMessage', 'Photo')}
                className="max-w-[240px] rounded-lg object-cover"
                loading="lazy"
              />
            )}
            {message.content && (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
            {!message.file_url && !message.content && (
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                <span>{tn('photoMessage', 'Photo')}</span>
              </div>
            )}
          </div>
        )}

        {message.message_type === 'document' && (
          <div className="space-y-1">
            {message.file_url ? (
              <a
                href={message.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 underline',
                  isSent ? 'text-[var(--color-text-inverse)]' : 'text-[var(--color-accent)]'
                )}
              >
                <FileText className="w-4 h-4" />
                <span>{message.content || tn('documentMessage', 'Document')}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>{message.content || tn('documentMessage', 'Document')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timestamp and read receipt */}
      <div className="flex items-center gap-1 mt-0.5 px-1">
        <span className="text-[11px] text-text-disabled">{formattedTime}</span>
        {isSent && (
          <span
            className={cn(
              'flex items-center',
              message.is_read ? 'text-[var(--color-success)]' : 'text-text-disabled'
            )}
            aria-label={message.is_read ? tn('read', 'Read') : tn('sent', 'Sent')}
          >
            {message.is_read ? (
              <CheckCheck className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}
