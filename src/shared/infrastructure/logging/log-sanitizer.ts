/**
 * Utilidades para registrar payloads en logs de forma segura:
 * - Redacta claves sensibles (passwords, tokens, api keys, etc.)
 * - Trunca strings y arrays muy largos
 * - Limita la profundidad de objetos anidados
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'clientsecret',
  'client_secret',
  'secret',
  'apikey',
  'api_key',
  'x-api-key',
  'authorization',
  'auth',
  'privatekey',
  'private_key',
]);

const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 50;

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[MaxDepthExceeded]';

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length}chars]`
      : value;
  }

  if (Buffer.isBuffer(value)) return `[Buffer:${value.length}bytes]`;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeForLog(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[...${value.length - MAX_ARRAY_ITEMS} more items]`);
    }
    return items;
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? '[REDACTED]'
        : sanitizeForLog(val, depth + 1);
    }
    return output;
  }

  return value;
}
