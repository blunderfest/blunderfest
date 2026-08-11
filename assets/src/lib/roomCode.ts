export const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ROOM_CODE_LENGTH = 5;

const ALPHABET = ROOM_ALPHABET;
const CODE_LENGTH = ROOM_CODE_LENGTH;

export function generateRoomCode(): string {
  // Codes are capability links, so they're drawn from a CSPRNG, rejecting
  // values ≥ 248 (8 × 31) so every letter is equally likely — a plain
  // `value % 31` would slightly favour the first few letters.
  const limit = 256 - (256 % ALPHABET.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    const values = new Uint8Array(CODE_LENGTH - code.length);
    crypto.getRandomValues(values);
    for (const value of values) {
      if (value < limit) {
        code += ALPHABET[value % ALPHABET.length];
      }
    }
  }
  return code;
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
