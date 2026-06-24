// settings.js — API key management
// Keys are stored in localStorage with lightweight XOR obfuscation.
// This is NOT cryptographic security — it's visual obfuscation for a personal tool.
// See DECISIONS.md for the rationale.

const PREFIX = 'im_k_';
const SALT   = 'IdeaMotorHUB09';

function xor(str, key) {
  return str.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
}

function encode(raw) {
  if (!raw) return '';
  try { return btoa(unescape(encodeURIComponent(xor(raw, SALT)))); } catch { return ''; }
}

function decode(encoded) {
  if (!encoded) return '';
  try { return xor(decodeURIComponent(escape(atob(encoded))), SALT); } catch { return ''; }
}

export const PROVIDERS = ['gemini', 'claude', 'openai', 'perplexity'];

export function saveKey(provider, key) {
  if (key && key.trim()) {
    localStorage.setItem(PREFIX + provider, encode(key.trim()));
  } else {
    localStorage.removeItem(PREFIX + provider);
  }
}

export function getKey(provider) {
  const raw = localStorage.getItem(PREFIX + provider);
  return raw ? decode(raw) : '';
}

export function getAllKeys() {
  return Object.fromEntries(PROVIDERS.map(p => [p, getKey(p)]));
}

export function saveAllKeys(keys) {
  PROVIDERS.forEach(p => saveKey(p, keys[p] || ''));
}
