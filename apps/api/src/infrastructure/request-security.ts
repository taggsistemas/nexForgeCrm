import type { RequestHandler } from 'express';
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
export function hasUnsafeInputKeys(input: unknown): boolean {
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (value === null || typeof value !== 'object') continue;
    if (depth > 20 || ++visited > 5000) return true;
    for (const [key, child] of Object.entries(value)) {
      if (++visited > 5000 || reserved.has(key) || /[$.\[\]]/.test(key)) return true;
      pending.push({ value: child, depth: depth + 1 });
    }
  }
  return false;
}
// Inspect structural keys, never SQL/HTML-looking text. Each route must still
// validate an explicit strict DTO; this guard does not authorize or sanitize data.
export const rejectUnsafeInputKeys: RequestHandler = (req, res, next) => {
  if (hasUnsafeInputKeys(req.body) || hasUnsafeInputKeys(req.query)) {
    res.status(400).json({ code: 'INVALID_REQUEST' }); return;
  }
  next();
};
