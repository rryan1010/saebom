import { assert, asyncProperty, integer, option, string } from 'fast-check';
import { describe, expect, it } from 'vitest';

import { CHUNK_UNITS, createChunkedStorage, type KeyValueStore } from './chunked-storage.ts';

function memoryStore(data: Map<string, string> = new Map()): KeyValueStore {
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

function crashingStore(data: Map<string, string>, failFromWrite: number): KeyValueStore {
  let writes = 0;
  const gate = () => {
    writes += 1;
    if (writes >= failFromWrite) throw new Error('crash');
  };
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      gate();
      data.set(key, value);
    },
    removeItem: async (key) => {
      gate();
      data.delete(key);
    },
  };
}

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
const anyText = string({ unit: 'binary', maxLength: CHUNK_UNITS * 4 });

describe('chunked storage', () => {
  it('reads nothing that was never written', async () => {
    expect(await createChunkedStorage(memoryStore()).getItem('k')).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['short', 'hello'],
    ['multi-chunk', 'x'.repeat(CHUNK_UNITS * 3 + 7)],
    ['non-ASCII', '새봄 café ✓'.repeat(400)],
    ['emoji across a chunk boundary', 'a'.repeat(CHUNK_UNITS - 1) + '😀'.repeat(50)],
  ])('round-trips %s values', async (_name, value) => {
    const storage = createChunkedStorage(memoryStore());
    await storage.setItem('k', value);
    expect(await storage.getItem('k')).toBe(value);
  });

  it('round-trips any string', async () => {
    await assert(
      asyncProperty(anyText, async (value) => {
        const storage = createChunkedStorage(memoryStore());
        await storage.setItem('k', value);
        expect(await storage.getItem('k')).toBe(value);
      }),
    );
  });

  it('keeps every stored entry within 2048 UTF-8 bytes', async () => {
    await assert(
      asyncProperty(anyText, async (value) => {
        const data = new Map<string, string>();
        await createChunkedStorage(memoryStore(data)).setItem('k', value);
        for (const stored of data.values()) expect(utf8Bytes(stored)).toBeLessThanOrEqual(2048);
      }),
    );
  });

  it('leaves no stray keys after overwriting a long value with a short one', async () => {
    const data = new Map<string, string>();
    const storage = createChunkedStorage(memoryStore(data));
    await storage.setItem('k', 'x'.repeat(CHUNK_UNITS * 5));
    await storage.setItem('k', 'short');
    expect(await storage.getItem('k')).toBe('short');
    expect(data.size).toBe(2);
    await storage.setItem('k', 'x'.repeat(CHUNK_UNITS * 2));
    await storage.setItem('k', 'x'.repeat(CHUNK_UNITS * 4));
    expect(data.size).toBe(1 + 4);
  });

  it('leaves no keys after removing', async () => {
    const data = new Map<string, string>();
    const storage = createChunkedStorage(memoryStore(data));
    await storage.setItem('k', 'x'.repeat(CHUNK_UNITS * 3));
    await storage.removeItem('k');
    expect(data.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });

  it('removing a missing key is a no-op', async () => {
    const storage = createChunkedStorage(memoryStore());
    await expect(storage.removeItem('missing')).resolves.toBeUndefined();
  });

  it('reads nothing when a chunk is missing', async () => {
    const data = new Map<string, string>();
    const storage = createChunkedStorage(memoryStore(data));
    await storage.setItem('k', 'x'.repeat(CHUNK_UNITS * 2));
    const chunkKey = [...data.keys()].find((key) => key !== 'k');
    data.delete(chunkKey ?? '');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('reads nothing when the pointer is malformed', async () => {
    const data = new Map([['k', 'garbage']]);
    expect(await createChunkedStorage(memoryStore(data)).getItem('k')).toBeNull();
  });

  it('after a crash at any write, reads exactly the old value or the new one', async () => {
    await assert(
      asyncProperty(
        option(anyText, { nil: null }),
        anyText,
        integer({ min: 1, max: 16 }),
        async (oldValue, newValue, failFromWrite) => {
          const data = new Map<string, string>();
          if (oldValue !== null) {
            await createChunkedStorage(memoryStore(data)).setItem('k', oldValue);
          }

          let finished = true;
          try {
            await createChunkedStorage(crashingStore(data, failFromWrite)).setItem('k', newValue);
          } catch {
            finished = false;
          }

          const read = await createChunkedStorage(memoryStore(data)).getItem('k');
          if (finished) expect(read).toBe(newValue);
          else expect([oldValue, newValue]).toContain(read);
        },
      ),
    );
  });
});
