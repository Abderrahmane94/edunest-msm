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
  /** To word the WhatsApp message for a parent, a teacher, a director… */
  role?: string;
  /** The school the account belongs to, when it is not the sender's own (a super admin creating it). */
  schoolName?: string;
  /**
   * Its email already had another account (another school, the platform):
   * this one opens with the temporary password, not the one the person knows.
   */
  otherAccount?: boolean;
}

/** What the server answers when it creates an account. */
export interface CreatedAccount {
  firstName?: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  temporaryPassword?: string;
  emailHasOtherAccount?: boolean;
}

type Listener = (account: NewAccount) => void;
const listeners = new Set<Listener>();

export function announceNewAccount(
  account: CreatedAccount | null | undefined,
  about: { role?: string; schoolName?: string } = {},
): void {
  const login = account?.email || account?.phone;
  if (!login || !account?.temporaryPassword) return;
  const { temporaryPassword, phone, firstName } = account;
  const role = about.role ?? account.role;
  const otherAccount = account.emailHasOtherAccount === true;
  for (const listener of listeners) listener({ login, temporaryPassword, phone, firstName, role, schoolName: about.schoolName, otherAccount });
}

export function onNewAccount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
