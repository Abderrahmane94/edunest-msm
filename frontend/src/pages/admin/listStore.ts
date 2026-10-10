import * as React from 'react';

/**
 * Where a list editor (emergency contacts, medical notes) reads and saves its
 * entries: straight to the server on a child's file, or in memory in the
 * creation wizard until the whole child is saved at once.
 */
export interface ListStore<T extends { id: string }, I> {
  items: T[];
  isLoading: boolean;
  isSaving: boolean;
  add: (input: I) => Promise<void>;
  update: (id: string, input: I) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Keeps the entries in the caller's state; nothing reaches the server. */
export function localListStore<T extends { id: string }, I>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  toItem: (input: I, id: string) => T,
): ListStore<T, I> {
  return {
    items,
    isLoading: false,
    isSaving: false,
    add: async (input) => setItems((prev) => [...prev, toItem(input, crypto.randomUUID())]),
    update: async (id, input) => setItems((prev) => prev.map((item) => (item.id === id ? toItem(input, id) : item))),
    remove: async (id) => setItems((prev) => prev.filter((item) => item.id !== id)),
  };
}
