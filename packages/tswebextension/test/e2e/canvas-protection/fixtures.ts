/**
 * Deterministic bitmap plus drawing state for paired real-browser canvases.
 */
export interface CanvasFixture {
    readonly width: number;
    readonly height: number;
    readonly pixels: readonly number[];
    readonly state: { readonly fillStyle: string; readonly globalAlpha: number; readonly lineWidth: number };
    readonly draw: (realm: Window & typeof globalThis) => CanvasRenderingContext2D;
}

/**
 * Creates uniform, varied opaque and mixed-alpha images with persistent drawing state.
 *
 * @param count Number of deterministic fixtures.
 *
 * @returns Independent fixture definitions, without creating an original canvas context.
 */
export function createCanvasFixtures(count: number): readonly CanvasFixture[] {
    return Array.from({ length: count }, (_, fixtureIndex) => {
        const width = 32 + fixtureIndex;
        const height = 24;
        const pixels = Array.from({ length: width * height * 4 }, (_channel, offset) => {
            const pixel = Math.floor(offset / 4);
            const channel = offset % 4;
            if (channel === 3) {
                if (fixtureIndex % 3 === 2 && pixel % 3 !== 0) {
                    return pixel % 3 === 1 ? 0 : 128;
                }
                return 255;
            }
            return fixtureIndex % 3 === 0 ? [16, 32, 48][channel] : (pixel * 13 + channel * 47) % 256;
        });
        const state = { fillStyle: '#123456', globalAlpha: 0.75, lineWidth: 3 };
        return {
            width,
            height,
            pixels,
            state,
            draw: (realm: Window & typeof globalThis): CanvasRenderingContext2D => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d')!;
                context.putImageData(new realm.ImageData(new realm.Uint8ClampedArray(pixels), width, height), 0, 0);
                context.fillStyle = state.fillStyle;
                context.globalAlpha = state.globalAlpha;
                context.lineWidth = state.lineWidth;
                context.setTransform(1, 0.2, 0.3, 1, 4, 5);
                context.beginPath();
                context.moveTo(2, 3);
                context.lineTo(8, 9);
                realm.document.body.appendChild(canvas);
                return context;
            },
        };
    });
}
