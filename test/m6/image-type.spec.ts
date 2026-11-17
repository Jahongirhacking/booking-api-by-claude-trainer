import { detectImageType } from '../../src/uploads/image-type';
import { jpeg, png, textFile, webp } from './helpers/files';

/**
 * Shartnoma: src/uploads/image-type.ts
 *   detectImageType(buffer: Buffer): 'png' | 'jpeg' | 'webp' | null
 * (faqat dastlabki baytlarga qaraydi; Content-Type yoki fayl nomiga ishonmaydi)
 */
describe('M6 | detectImageType (unit)', () => {
  it('PNG', () => expect(detectImageType(png())).toBe('png'));
  it('JPEG', () => expect(detectImageType(jpeg())).toBe('jpeg'));
  it('WEBP', () => expect(detectImageType(webp())).toBe('webp'));

  it('oddiy matn -> null', () => expect(detectImageType(textFile())).toBeNull());
  it('bo`sh buffer -> null', () => expect(detectImageType(Buffer.alloc(0))).toBeNull());
  it('juda qisqa buffer (xato tashlamasdan) -> null', () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(detectImageType(Buffer.from([0xff]))).toBeNull();
  });

  it('RIFF bor, lekin WEBP emas (masalan WAV) -> null', () => {
    const wav = Buffer.alloc(32);
    wav.write('RIFF', 0, 'ascii');
    wav.write('WAVE', 8, 'ascii');
    expect(detectImageType(wav)).toBeNull();
  });

  it('PNG bayt ketma-ketligi boshida bo`lmasa (oxirida) -> null', () => {
    const buf = Buffer.concat([Buffer.from('xx'), png()]);
    expect(detectImageType(buf)).toBeNull();
  });
});
