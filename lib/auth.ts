// Session-token helpers for the Google-Sheet-backed login system.
//
// Users are stored in the "Users" sheet (Username | Password | Added_Date)
// so the team can manage accounts by editing the sheet directly - the same
// pattern as the Customers sheet. Because of that, passwords are stored as
// plain text in the sheet; anyone with edit access to the spreadsheet can
// read them, which is an accepted trade-off for this internal tool (do NOT
// reuse passwords from other systems).
//
// A successful login sets an HTTP-only cookie holding an HMAC-SHA256-signed
// token (username + expiry). Everything here uses the Web Crypto API so the
// same code runs in both the Node route handlers and the Edge middleware.

export const SESSION_COOKIE = "ptw_session";
// Display-only cookie (NOT trusted for auth) so client components can show
// who is logged in.
export const USER_DISPLAY_COOKIE = "ptw_user";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Set AUTH_SECRET in .env for production use; the fallback keeps local dev
// working out of the box.
const SECRET = process.env.AUTH_SECRET || "ptw-jigfixture-dev-secret-change-me";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmac(payload: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return new Uint8Array(sig);
}

/** Creates a signed session token for `username`, valid for SESSION_MAX_AGE_SECONDS. */
export async function createSessionToken(username: string): Promise<string> {
  const payload = JSON.stringify({
    u: username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const sig = toBase64Url(await hmac(payloadB64));
  return `${payloadB64}.${sig}`;
}

/** Returns the username for a valid, unexpired token; null otherwise. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  const expected = await hmac(payloadB64);
  const given = fromBase64Url(sigB64);
  if (!given || given.length !== expected.length) return null;
  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i];
  if (diff !== 0) return null;

  const payloadBytes = fromBase64Url(payloadB64);
  if (!payloadBytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      u?: unknown;
      exp?: unknown;
    };
    if (typeof payload.u !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload.u;
  } catch {
    return null;
  }
}
