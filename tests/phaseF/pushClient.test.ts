import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from '../../src/core/lib/push';

/**
 * The VAPID applicationServerKey must decode base64url → the exact 65-byte
 * uncompressed EC P-256 point, or PushManager.subscribe() rejects and no push
 * ever arrives. Guard the decode against padding/charset regressions.
 */
describe('urlBase64ToUint8Array', () => {
  it('decodes a real VAPID public key to 65 bytes starting with 0x04', () => {
    // A representative uncompressed-point VAPID public key (base64url, no padding).
    const key = 'BAA8qdwHY6mcME01vWAlqSerXsaYCMVLEMD0M7bEeseZ6wssSAMKs1R4dFNFtBk_Y7x1nnL9NUX-T3uAIOxn17M';
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04); // uncompressed-point prefix
  });

  it('handles base64url chars (- and _) and missing padding', () => {
    // '-' and '_' are base64url for '+' and '/'. "aa==" family: decode "0-_9".
    const bytes = urlBase64ToUint8Array('-_-_');
    expect(bytes.length).toBe(3);
    expect(bytes[0]).toBe(0xfb); // 0b111110_11 from "- _"
  });
});
