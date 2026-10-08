import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/lib/errorMessage';

/** The chat's file limit on the server (photos and documents). */
export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_DOCUMENTS = /\.(pdf|docx?|xlsx?|txt)$/i;

interface SendMutation<V> {
  mutate: (variables: V, options?: { onError?: (err: unknown) => void; onSuccess?: () => void }) => void;
}

/**
 * Sending in a chat with visible failures: a file too big or of the wrong
 * type is refused before upload, and a failed send says why (instead of the
 * message or file silently disappearing). Show `error` above the input.
 */
export function useChatSend() {
  const { t } = useTranslation();
  const [error, setError] = React.useState<string | null>(null);

  const sendFile = React.useCallback(
    (
      mutation: SendMutation<{ file: File; messageType: 'photo' | 'document' }>,
      file: File,
      messageType: 'photo' | 'document',
    ) => {
      if (file.size > CHAT_FILE_MAX_BYTES) {
        setError(t('errors.fileTooLargeMax', { max: '10 Mo' }));
        return;
      }
      const typeOk = messageType === 'photo' ? file.type.startsWith('image/') : ALLOWED_DOCUMENTS.test(file.name);
      if (!typeOk) {
        setError(t('errors.fileType'));
        return;
      }
      setError(null);
      mutation.mutate({ file, messageType }, { onError: (err) => setError(errorMessage(err, t)) });
    },
    [t],
  );

  /** For a send that isn't a file (e.g. a text message): shows its failure. */
  const onError = React.useCallback((err: unknown) => setError(errorMessage(err, t)), [t]);

  return { error, clearError: () => setError(null), sendFile, onError };
}
