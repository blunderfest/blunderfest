export const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ROOM_CODE_LENGTH = 5;

const ALPHABET = ROOM_ALPHABET;
const CODE_LENGTH = ROOM_CODE_LENGTH;

export function generateRoomCode(): string {
  // Codes are capability links, so they're drawn from a CSPRNG. 2^32 is an
  // exact multiple of the alphabet length, so there's no modulo bias.
  const values = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join('');
}

export function normalizeRoomCode(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function validRoomCode(code: string): boolean {
  return /^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/.test(code);
}
