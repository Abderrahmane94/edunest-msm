/**
 * An account was just created with a temporary password of its own: the
 * password is shown once to whoever created it (see NewAccountDialog).
 */
export interface NewAccount {
  email: string;
  temporaryPassword: string;
}

type Listener = (account: NewAccount) => void;
const listeners = new Set<Listener>();

export function announceNewAccount(account: Partial<NewAccount> | null | undefined): void {
  if (!account?.email || !account.temporaryPassword) return;
  for (const listener of listeners) listener({ email: account.email, temporaryPassword: account.temporaryPassword });
}

export function onNewAccount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
