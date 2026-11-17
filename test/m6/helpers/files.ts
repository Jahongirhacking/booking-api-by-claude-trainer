import { readdir, rm } from 'fs/promises';
import { resolve } from 'path';

export const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/** UPLOAD_DIR (.env.test) — yo'lida "test" so'zi bo'lishi shart (haqiqiy papkani tozalab yubormaslik uchun). */
export function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR;
  if (!dir || !/test/i.test(dir)) {
    throw new Error(
      `[TEST GUARD] UPLOAD_DIR="${dir}" — .env.test da UPLOAD_DIR "test" so'zini o'z ichiga olishi kerak (masalan ./uploads-test).`,
    );
  }
  return resolve(process.cwd(), dir);
}

export const cleanUploads = () => rm(uploadDir(), { recursive: true, force: true });

/** Upload papkasidagi barcha fayllar (rekursiv). Papka yo'q bo'lsa — bo'sh ro'yxat. */
export async function listUploaded(): Promise<string[]> {
  try {
    const entries = await readdir(uploadDir(), { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Test rasmlari: haqiqiy "magic bytes" sarlavhasi + nol bilan to'ldirish.
 * Talab: server fayl turini mijoz yuborgan Content-Type/kengaytma bo'yicha emas,
 * AYNAN shu sarlavha baytlari bo'yicha aniqlaydi. To'liq dekodlash talab qilinmaydi.
 */
const withHead = (head: Buffer, size: number): Buffer => {
  const buf = Buffer.alloc(Math.max(size, head.length));
  head.copy(buf);
  return buf;
};

export const png = (size = 128) => withHead(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), size);
export const jpeg = (size = 128) => withHead(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size);
export const webp = (size = 128) => {
  const buf = Buffer.alloc(Math.max(size, 20));
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  return buf;
};
export const textFile = () => Buffer.from('Hello, I am definitely not an image.\n');
export const svg = () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
