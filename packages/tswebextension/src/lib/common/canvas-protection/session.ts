import { type ProtectionSession } from './contracts';

/**
 * Root seed of canvas noise for one browser session.
 */
export class CanvasProtectionSession {
    /**
     * Creates a session with a fresh root and generation.
     *
     * @returns New session.
     */
    public static create(): ProtectionSession {
        return {
            root: CanvasProtectionSession.randomHex(),
            generation: CanvasProtectionSession.randomHex(),
        };
    }

    /**
     * Creates an independent 128-bit random value encoded as lowercase hex.
     *
     * @returns A 16-byte random value.
     */
    private static randomHex(): string {
        return Array.from(
            crypto.getRandomValues(new Uint8Array(16)),
            (byte) => byte.toString(16).padStart(2, '0'),
        ).join('');
    }
}
