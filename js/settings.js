// settings.js — API key management
// Keys are stored in IndexedDB (robust on iOS standalone PWAs, where localStorage
// can be wiped between launches), with lightweight XOR obfuscation.
// A small in-memory cache keeps getKey/getAllKeys synchronous for the rest of the app;
// loadKeys() must run once at boot to populate it. See DECISIONS.md for the rationale.

import { getSetting, setSetting } from './storage.js';

const SALT      = 'IdeaMotorHUB09';
const LS_PREFIX = 'im_k_'; // legacy localStorage prefix — read once for migration

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

// In-memory cache of decoded keys. Populated by loadKeys() at boot.
let _cache = {};

/**
 * Load keys from IndexedDB into the in-memory cache. Migrates any legacy keys
 * found in localStorage (older versions stored them there). Call once at startup
 * before getKey/getAllKeys are used.
 */
export async function loadKeys() {
  _cache = {};
  for (const p of PROVIDERS) {
    let enc;
    try { enc = await getSetting('k_' + p); } catch { enc = undefined; }

    // Migration: if absent in IndexedDB but present in old localStorage, carry it over.
    if (!enc) {
      let legacy = null;
      try { legacy = localStorage.getItem(LS_PREFIX + p); } catch { legacy = null; }
      if (legacy) {
        enc = legacy;
        try { await setSetting('k_' + p, legacy); } catch { /* ignore */ }
      }
    }

    _cache[p] = enc ? decode(enc) : '';
  }
  return _cache;
}

export function getKey(provider) {
  return _cache[provider] || '';
}

export function getAllKeys() {
  return Object.fromEntries(PROVIDERS.map(p => [p, _cache[p] || '']));
}

export function saveKey(provider, key) {
  const trimmed = key && key.trim() ? key.trim() : '';
  _cache[provider] = trimmed;
  const enc = trimmed ? encode(trimmed) : '';

  // Primary store: IndexedDB (fire-and-forget; cache already updated for the UI).
  setSetting('k_' + provider, enc).catch(() => {});

  // Secondary best-effort copy in localStorage (helps migration / non-standalone contexts).
  try {
    if (enc) localStorage.setItem(LS_PREFIX + provider, enc);
    else localStorage.removeItem(LS_PREFIX + provider);
  } catch { /* ignore */ }
}

export function saveAllKeys(keys) {
  PROVIDERS.forEach(p => saveKey(p, keys[p] || ''));
}
