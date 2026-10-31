export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// 600 UTF-16 units encode to at most 1800 UTF-8 bytes, under SecureStore's 2048-byte guidance.
export const CHUNK_UNITS = 600;

type Slot = 'a' | 'b';
type Pointer = { slot: Slot; count: number };

const POINTER_PATTERN = /^([ab]):(\d+)$/;

function parsePointer(raw: string | null): Pointer | null {
  const match = raw === null ? null : POINTER_PATTERN.exec(raw);
  if (match === null) return null;
  return { slot: match[1] === 'b' ? 'b' : 'a', count: Number(match[2]) };
}

function chunkKey(key: string, slot: Slot, index: number): string {
  return `${key}.${slot}.${index}`;
}

function isHighSurrogate(unit: number): boolean {
  return unit >= 0xd800 && unit <= 0xdbff;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + CHUNK_UNITS, value.length);
    if (end < value.length && isHighSurrogate(value.charCodeAt(end - 1))) end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks.length === 0 ? [''] : chunks;
}

async function removeChunks(store: KeyValueStore, key: string, pointer: Pointer): Promise<void> {
  for (let i = 0; i < pointer.count; i += 1) {
    await store.removeItem(chunkKey(key, pointer.slot, i));
  }
}

// The pointer is written last, so a crash leaves either the old value or the new one readable.
export function createChunkedStorage(store: KeyValueStore): KeyValueStore {
  return {
    async getItem(key) {
      const pointer = parsePointer(await store.getItem(key));
      if (pointer === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < pointer.count; i += 1) {
        const part = await store.getItem(chunkKey(key, pointer.slot, i));
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const old = parsePointer(await store.getItem(key));
      const slot: Slot = old?.slot === 'a' ? 'b' : 'a';
      const chunks = splitIntoChunks(value);
      for (const [i, chunk] of chunks.entries()) {
        await store.setItem(chunkKey(key, slot, i), chunk);
      }
      await store.setItem(key, `${slot}:${chunks.length}`);
      if (old !== null) await removeChunks(store, key, old);
    },

    async removeItem(key) {
      const old = parsePointer(await store.getItem(key));
      await store.removeItem(key);
      if (old !== null) await removeChunks(store, key, old);
    },
  };
}
