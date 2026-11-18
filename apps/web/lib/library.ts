'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { accountFetch } from './account';

/**
 * The reader's marks (saved, read, in progress, book status) for what the page shows, kept in
 * one small client store so every button on a page agrees and updates instantly. Nothing is
 * fetched for guests.
 */
export type WorkStatus = 'READING' | 'DONE';
export type BookStatus = 'WANT' | 'READING' | 'DONE';
export type FavoriteKind = 'work' | 'book' | 'author';

interface Marks {
  saved: Record<FavoriteKind, Set<string>>;
  works: Record<string, { status: WorkStatus; progress: number; updatedAt?: string }>;
  books: Record<string, { status: BookStatus; lastWorkId: string | null }>;
}

let marks: Marks = { saved: { work: new Set(), book: new Set(), author: new Set() }, works: {}, books: {} };
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders when any mark changes; returns the current marks */
export function useMarks(): Marks {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return marks;
}

export function resetMarks() {
  marks = { saved: { work: new Set(), book: new Set(), author: new Set() }, works: {}, books: {} };
  asked.clear();
  queue = null;
  epoch++;
  emit();
}

interface StateResponse {
  saved: { works: string[]; books: string[]; authors: string[] };
  works: Marks['works'];
  books: Marks['books'];
}

type MarkIds = { workIds?: string[]; collectionIds?: string[]; authorIds?: string[] };
type IdKind = keyof MarkIds;
const KINDS: IdKind[] = ['workIds', 'collectionIds', 'authorIds'];
// Marks asked for this recently aren't asked for again: they are kept current by the reader's
// own actions, and a later page view picks up what changed on another device
const FRESH_MS = 30_000;
const asked = new Map<string, number>();
let queue: Record<IdKind, Set<string>> | null = null;
// Bumped on sign-out, so an answer for the previous reader is dropped
let epoch = 0;

function flush() {
  const batch = queue;
  queue = null;
  if (!batch) return;
  const sentIn = epoch;
  const body: MarkIds = {};
  for (const kind of KINDS) if (batch[kind].size) body[kind] = [...batch[kind]];
  accountFetch<StateResponse>('/me/state', { method: 'POST', body: JSON.stringify(body) })
    .then((s) => {
      if (sentIn !== epoch) return;
      s.saved.works.forEach((id) => marks.saved.work.add(id));
      s.saved.books.forEach((id) => marks.saved.book.add(id));
      s.saved.authors.forEach((id) => marks.saved.author.add(id));
      Object.assign(marks.works, s.works);
      Object.assign(marks.books, s.books);
      emit();
    })
    .catch(() => {
      // Not loaded: the next component to ask tries again
      for (const kind of KINDS) batch[kind].forEach((id) => asked.delete(`${kind}:${id}`));
    });
}

/**
 * Asks for the marks of these ids. Every component on a page that asks in the same tick
 * (the text's progress bar, the actions under it, a book's contents) shares one request.
 */
export function requestMarks(ids: MarkIds) {
  const now = Date.now();
  for (const kind of KINDS) {
    for (const id of ids[kind] ?? []) {
      const key = `${kind}:${id}`;
      if (now - (asked.get(key) ?? 0) < FRESH_MS) continue;
      asked.set(key, now);
      if (!queue) {
        queue = { workIds: new Set(), collectionIds: new Set(), authorIds: new Set() };
        queueMicrotask(flush);
      }
      queue[kind].add(id);
    }
  }
}

/** Loads the marks for these ids once the reader is known to be signed in */
export function useLoadMarks(signedIn: boolean, ids: MarkIds) {
  const key = JSON.stringify(ids);
  useEffect(() => {
    if (signedIn) requestMarks(JSON.parse(key) as MarkIds);
  }, [signedIn, key]);
}

export async function setSaved(kind: FavoriteKind, id: string, on: boolean) {
  const set = marks.saved[kind];
  const before = set.has(id);
  if (on) set.add(id);
  else set.delete(id);
  emit();
  try {
    await accountFetch(`/me/favorites/${kind}/${encodeURIComponent(id)}`, { method: on ? 'PUT' : 'DELETE' });
  } catch (err) {
    if (before) set.add(id);
    else set.delete(id);
    emit();
    throw err;
  }
}

export async function setWorkStatus(workId: string, status: WorkStatus | null) {
  const before = marks.works[workId];
  if (status) marks.works[workId] = { ...(before ?? { progress: 0 }), status };
  else delete marks.works[workId];
  emit();
  try {
    const saved = await accountFetch<{ status: WorkStatus | null; progress: number }>(`/me/reading/${encodeURIComponent(workId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (saved.status) marks.works[workId] = { status: saved.status, progress: saved.progress };
    emit();
  } catch (err) {
    if (before) marks.works[workId] = before;
    else delete marks.works[workId];
    emit();
    throw err;
  }
}

export async function setBookStatus(collectionId: string, status: BookStatus | null, partIds: string[] = []) {
  const before = marks.books[collectionId];
  if (status) marks.books[collectionId] = { lastWorkId: before?.lastWorkId ?? null, status };
  else delete marks.books[collectionId];
  // "Read" marks every part read, on the server too
  if (status === 'DONE') partIds.forEach((id) => (marks.works[id] = { status: 'DONE', progress: 1 }));
  emit();
  try {
    await accountFetch(`/me/books/${encodeURIComponent(collectionId)}`, { method: 'PUT', body: JSON.stringify({ status }) });
  } catch (err) {
    if (before) marks.books[collectionId] = before;
    else delete marks.books[collectionId];
    emit();
    throw err;
  }
}

/**
 * Sends a reading position. Paced by the caller (ReadingProgress syncs about every ten
 * seconds while the reader scrolls); on leaving the page it goes with keepalive so it
 * survives the navigation.
 */
export function sendProgress(workId: string, progress: number, { beacon = false } = {}) {
  const prev = marks.works[workId];
  marks.works[workId] = { status: progress >= 0.98 || prev?.status === 'DONE' ? 'DONE' : 'READING', progress };
  const body = JSON.stringify({ progress: Math.round(progress * 10_000) / 10_000 });
  if (beacon) {
    // keepalive lets the request outlive the page; unlike sendBeacon it can PUT and set headers
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/me/reading/${encodeURIComponent(workId)}`, {
      method: 'PUT',
      body,
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'x-kitabxana': '1' },
    }).catch(() => {});
    return;
  }
  accountFetch(`/me/reading/${encodeURIComponent(workId)}`, { method: 'PUT', body }).catch(() => {});
}

/** Places kept in this browser before signing in, handed to the account once */
export async function importLocalPositions() {
  const items: { slug: string; progress: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('irs-reading-pos:')) continue;
      const progress = Number(localStorage.getItem(key));
      if (progress > 0 && progress < 1) items.push({ slug: key.slice('irs-reading-pos:'.length), progress });
    }
  } catch {
    return;
  }
  if (items.length) await accountFetch('/me/reading/import', { method: 'POST', body: JSON.stringify({ items }) }).catch(() => {});
}
