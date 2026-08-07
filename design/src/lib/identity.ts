export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no i l o 0 1

export function makeRoomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++)
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export function normalizeCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
}

export function isValidCode(input: string): boolean {
  const code = normalizeCode(input);
  return code.length === 5 && [...code].every((c) => CODE_ALPHABET.includes(c));
}

const ADJECTIVES = [
  "Brave", "Zwischenzug", "Calm", "Sharp", "Prophylactic", "Fianchetto",
  "Stubborn", "Gambit", "Quiet", "Zonked", "Tempo", "Passed",
  "Cheerful", "Rook-lifting", "Doubled", "Sneaky", "Patient", "Blundering",
  "Studious", "Overworked", "Desperado", "Fearless",
];

const ANIMALS = [
  "Otter", "Pelican", "Badger", "Heron", "Mongoose", "Capybara",
  "Falcon", "Marmot", "Ibex", "Narwhal", "Gecko", "Puffin",
  "Tapir", "Wombat", "Lynx", "Kestrel", "Axolotl", "Quokka",
];

export function generateName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const n = 10 + Math.floor(Math.random() * 89);
  return `${a} ${b} ${n}`;
}

export function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Deterministic hue so each member gets a stable presence colour. */
export function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export type Role = "owner" | "collaborator" | "viewer";

export const ROLE_META: Record<
  Role,
  { label: string; glyph: string; tone: string; hint: string }
> = {
  owner: {
    label: "Owner",
    glyph: "\u2654",
    tone: "text-gold-hi",
    hint: "Controls the room, can present and manage roles",
  },
  collaborator: {
    label: "Collaborator",
    glyph: "\u2658",
    tone: "text-silver",
    hint: "Can play moves, add variations and comment",
  },
  viewer: {
    label: "Viewer",
    glyph: "\u2659",
    tone: "text-faint",
    hint: "Can watch and navigate their own copy of the board",
  },
};
