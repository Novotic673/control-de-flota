/** Detección del tipo real de archivo por firma binaria (sin dependencias). */
type Kind = { mime: string; ext: string };
export const IMAGE_KINDS = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const DOC_KINDS = [...IMAGE_KINDS, "application/pdf"];

export function sniff(buf: Buffer): Kind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "mif1", "msf1", "heim", "heis"].includes(brand)) return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

