/**
 * An account was just created with a temporary password of its own: the
 * password is shown once to whoever created it (see NewAccountDialog).
 */
export interface NewAccount {
  /** What the account signs in with: its email, or its phone number when it has none. */
  login: string;
  temporaryPassword: string;
  /** To send it by WhatsApp. */
  phone?: string | null;
  firstName?: string;
}

/** What the server answers when it creates an account. */
export interface CreatedAccount {
  firstName?: string;
  email?: string | null;
  phone?: string | null;
  temporaryPassword?: string;
}

type Listener = (account: NewAccount) => void;
const listeners = new Set<Listener>();

export function announceNewAccount(account: CreatedAccount | null | undefined): void {
  const login = account?.email || account?.phone;
  if (!login || !account?.temporaryPassword) return;
  const { temporaryPassword, phone, firstName } = account;
  for (const listener of listeners) listener({ login, temporaryPassword, phone, firstName });
}

export function onNewAccount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
