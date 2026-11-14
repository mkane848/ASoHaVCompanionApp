/** Ids and timestamps, in a module of their own so the rule modules (`engine.ts`, `enemies.ts`)
 *  can use them without importing `logic.ts`, which imports them back for `normalizeEncounter`.
 *  `logic.ts` re-exports both, so every existing import of them still works. */
export function nowIso(): string {
  return new Date().toISOString();
}

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 16;

/** Sixteen base-36 characters from the platform CSPRNG (`crypto.getRandomValues`, present in every
 *  supported browser and in Node 22), about 82 bits. This was eight characters of `Math.random()`,
 *  which is predictable and short, and an id is what a campaign-scoped route is handed to look a
 *  record up by. Bytes of 252 and above are rejected so the 36-way split has no modulo bias.
 *  Not rules-engine randomness: an id decides nothing about play. */
function randomSuffix(): string {
  let out = '';
  while (out.length < ID_LENGTH) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(ID_LENGTH));
    for (const b of bytes) {
      if (b < 252 && out.length < ID_LENGTH) out += ID_ALPHABET[b % 36];
    }
  }
  return out;
}

export function newId(prefix = 'x'): string {
  return `${prefix}-${randomSuffix()}`;
}
