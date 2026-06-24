/**
 * Validates an uploaded logo supplied as a base64 data URL. Enforces:
 *  - a strict image MIME allowlist (no arbitrary file types),
 *  - a maximum size,
 *  - real file-signature (magic byte) checks so a non-image can't be disguised
 *    with an image MIME type,
 *  - SVG content sanitisation checks (reject scripts / event handlers / external
 *    entities) to prevent stored XSS.
 *
 * Returns a normalised data URL on success.
 */

const MAX_BYTES = 256 * 1024; // 256 KB

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

function startsWith(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

export type LogoResult = { ok: true; value: string } | { ok: false; error: string };

export function validateLogo(dataUrl: string): LogoResult {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return { ok: false, error: "Logo must be a base64 image data URL." };

  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Unsupported image type. Use PNG, JPG, GIF, WebP or SVG." };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(match[2], "base64");
  } catch {
    return { ok: false, error: "Invalid image data." };
  }
  if (buf.length === 0) return { ok: false, error: "The image is empty." };
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: `Logo is too large (${Math.round(buf.length / 1024)} KB). Max is 256 KB.` };
  }

  // Verify the bytes actually match the claimed image format.
  switch (mime) {
    case "image/png":
      if (!startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        return { ok: false, error: "File is not a valid PNG image." };
      break;
    case "image/jpeg":
      if (!startsWith(buf, [0xff, 0xd8, 0xff]))
        return { ok: false, error: "File is not a valid JPEG image." };
      break;
    case "image/gif": {
      const head = buf.subarray(0, 6).toString("ascii");
      if (head !== "GIF87a" && head !== "GIF89a")
        return { ok: false, error: "File is not a valid GIF image." };
      break;
    }
    case "image/webp":
      if (buf.subarray(0, 4).toString("ascii") !== "RIFF" || buf.subarray(8, 12).toString("ascii") !== "WEBP")
        return { ok: false, error: "File is not a valid WebP image." };
      break;
    case "image/svg+xml": {
      const text = buf.toString("utf8");
      if (!/<svg[\s>]/i.test(text)) return { ok: false, error: "File is not a valid SVG." };
      // Reject scripting / interactive / external-entity vectors.
      if (/<script|<foreignObject|<iframe|<!ENTITY|javascript:|data:text\/html|\son\w+\s*=/i.test(text)) {
        return { ok: false, error: "SVG contains disallowed content (scripts/handlers)." };
      }
      break;
    }
  }

  // Re-emit a clean, canonical data URL.
  return { ok: true, value: `data:${mime};base64,${buf.toString("base64")}` };
}
