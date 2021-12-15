import { TextEncoder, TextDecoder } from 'text-encoding';

describe('Encoders', () => {
    const message = 'test 123';

    it('checks default settings', () => {
        const textEncoderUtf8 = new TextEncoder();
        const textDecoderUtf8 = new TextDecoder();

        const encoded = textEncoderUtf8.encode(message);
        const decoded = textDecoderUtf8.decode(encoded);
        expect(decoded).toBe(message);
    });

    it('checks win-1251', () => {
        const textEncoderWin1251 = new TextEncoder('windows-1251', { NONSTANDARD_allowLegacyEncoding: true });
        const textDecoderWin1251 = new TextDecoder('windows-1251');

        const encoded = textEncoderWin1251.encode(message);
        const decoded = textDecoderWin1251.decode(encoded);
        expect(decoded).toBe(message);
    });

    it('checks win-1252', () => {
        const textEncoderIso8859 = new TextEncoder('windows-1252', { NONSTANDARD_allowLegacyEncoding: true });
        const textDecoderIso8859 = new TextDecoder('windows-1252');

        const encoded = textEncoderIso8859.encode(message);
        const decoded = textDecoderIso8859.decode(encoded);
        expect(decoded).toBe(message);
    });
});
