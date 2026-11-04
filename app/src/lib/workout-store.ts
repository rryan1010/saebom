import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { EMPTY_STATE, parseState, type WorkoutState } from './workout.ts';

// The POC keeps everything on the phone: one JSON document, rewritten after every change, so a
// killed app resumes the session where it stopped (§8).
const STORAGE_KEY = 'saebom.workout.v1';

let state: WorkoutState = EMPTY_STATE;
let loaded = false;
let loading: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadWorkoutState(): Promise<void> {
  loading ??= (async () => {
    try {
      state = parseState(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      state = EMPTY_STATE;
    }
    loaded = true;
    emit();
  })();
  return loading;
}

export function getWorkoutState(): WorkoutState {
  return state;
}

/** Applies a change from workout.ts, saves it in order behind earlier saves, and re-renders. */
export function updateWorkoutState(change: (current: WorkoutState) => WorkoutState): void {
  const next = change(state);
  if (next === state) return;
  state = next;
  const raw = JSON.stringify(next);
  writes = writes.then(() => AsyncStorage.setItem(STORAGE_KEY, raw)).catch(() => {});
  emit();
}

export function useWorkoutState(): WorkoutState {
  return useSyncExternalStore(subscribe, getWorkoutState, getWorkoutState);
}

const isLoaded = () => loaded;

export function useWorkoutStateLoaded(): boolean {
  return useSyncExternalStore(subscribe, isLoaded, isLoaded);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
