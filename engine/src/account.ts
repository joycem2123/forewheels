// Account rules shared by the app and the server setup (same rules as Clutch Up).

/** Password rules. The server enforces the same ones for new and changed passwords. */
export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'A number (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'A special character (like ! @ # $ ?)', test: (p) => /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(p) },
];

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

/** Usernames: 3–20 lowercase letters, numbers, _ or . */
export const USERNAME_RULE = /^[a-z0-9_.]{3,20}$/;

/** Lowercase and keep only allowed characters, as the person types. */
export const cleanUsername = (u: string) => u.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);

export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Sign-in accepts an email or a username (with or without a leading @). */
export const looksLikeEmail = (s: string) => s.includes('@') && !s.trim().startsWith('@');
