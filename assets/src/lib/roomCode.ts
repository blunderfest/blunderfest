export const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ROOM_CODE_LENGTH = 5;

const ALPHABET = ROOM_ALPHABET;
const CODE_LENGTH = ROOM_CODE_LENGTH;

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
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
