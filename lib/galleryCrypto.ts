// Gallery share-file crypto. AES-256-GCM via Web Crypto — same API in Node 22+
// (`globalThis.crypto`) and Cloudflare Workers, so the `runtime = "nodejs"`
// routes still port cleanly to the OpenNext / Cloudflare build later.
//
// Threat model:
//   - Confidentiality: scene URLs + dialogue stay opaque to a casual recipient
//     who isn't going through our server (can't curl the file and grep prompts).
//   - Integrity: GCM's built-in auth tag means flipping any byte in the
//     ciphertext or nonce makes subtle.decrypt throw — no separate HMAC needed.
//   - NOT a replay defense: anyone with a valid file can replay it forever
//     (this is intentional — it's a share-with-a-friend file, not an auth token).
//
// File layout (all big-endian, raw bytes):
//   0..3   "IFPL"          magic — lets us refuse anything that's not ours
//   4      version (=1)    bumped if the format ever changes
//   5..16  nonce (12 B)    random per file; GCM requires non-repeating nonces
//                          per key (12-B random gives ~2^-32 collision risk at
//                          ~4B files — way more than this app will ever produce)
//   17..   ciphertext      includes the 16-byte GCM auth tag at the end
//
// Key derivation: SHA-256 of the secret. We don't bother with HKDF/scrypt —
// the secret is already high-entropy (deployer-supplied 32+ char string),
// SHA-256 just normalizes it to AES-256's 32-byte key length.

const MAGIC = [0x49, 0x46, 0x50, 0x4c] as const; // "IFPL"
const VERSION = 1;
const NONCE_LEN = 12;
const HEADER_LEN = MAGIC.length + 1 + NONCE_LEN;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey(
    "raw",
    material,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function packDoc(
  docStr: string,
  secret: string,
): Promise<Uint8Array> {
  const key = await deriveKey(secret);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const plaintext = new TextEncoder().encode(docStr);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext),
  );

  const out = new Uint8Array(HEADER_LEN + ciphertext.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = VERSION;
  out.set(nonce, MAGIC.length + 1);
  out.set(ciphertext, HEADER_LEN);
  return out;
}

export async function unpackDoc(
  blob: Uint8Array,
  secret: string,
): Promise<string> {
  // 16 = minimum ciphertext length (auth tag alone, with empty plaintext)
  if (blob.length < HEADER_LEN + 16) {
    throw new Error("文件太小,不是合法的图集分享文件");
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[i] !== MAGIC[i]) {
      throw new Error("文件格式不对,不是合法的图集分享文件");
    }
  }
  const version = blob[MAGIC.length];
  if (version !== VERSION) {
    throw new Error(`图集分享文件版本不被支持: v${version}`);
  }
  const nonce = blob.slice(MAGIC.length + 1, HEADER_LEN);
  const ciphertext = blob.slice(HEADER_LEN);

  const key = await deriveKey(secret);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      ciphertext,
    );
  } catch {
    // GCM auth tag failure → decryption refuses. Maps tamper + wrong-key both
    // here, which is the right behavior: we can't distinguish, and neither
    // should leak more than "this file isn't for this server".
    throw new Error("文件校验失败:可能被改动过,或来自另一台部署");
  }
  return new TextDecoder().decode(plaintext);
}
