import { describe, expect, test } from 'vitest';

import { INERT_CONTEXT_METHODS } from '../../../src/lib/common/canvas-protection/taint';

import {
    createFilled,
    HEIGHT,
    install,
    readoutKind,
    type Realm,
    WIDTH,
    withRealm,
} from './generated-realm';
import { referenceSourceNoise } from './noise-reference';

const blobBytes = (toBlob: HTMLCanvasElement['toBlob'], canvas: HTMLCanvasElement): Promise<number[]> => (
    new Promise((resolve) => {
        Reflect.apply(toBlob, canvas, [async (blob: Blob): Promise<void> => {
            resolve(Array.from(new Uint8Array(await blob.arrayBuffer())));
        }]);
    })
);

type Draw = (context: CanvasRenderingContext2D, realm: Realm) => void | Promise<void>;

// Each call leaves the pixels unchanged, so the expected noise is that of the filled bitmap.
const rendering: [string, Draw][] = [
    ['fillRect', (context): void => context.fillRect(0, 0, 0, 0)],
    ['strokeRect', (context): void => context.strokeRect(0, 0, 0, 0)],
    ['fill', (context): void => context.fill()],
    ['stroke', (context): void => context.stroke()],
    ['fillText', (context): void => context.fillText('', 0, 0)],
    ['strokeText', (context): void => context.strokeText('', 0, 0)],
    ['drawFocusIfNeeded', (context): void => context.drawFocusIfNeeded(context.canvas)],
    ['drawImage from a canvas', (context, realm): void => {
        const source = realm.document.createElement('canvas');
        source.width = 1;
        source.height = 1;
        context.drawImage(source, WIDTH, HEIGHT);
    }],
    ['drawImage from an image', (context, realm): void => context.drawImage(realm.document.createElement('img'), 0, 0)],
    ['drawImage from a bitmap', async (context, realm): Promise<void> => {
        context.drawImage(await realm.createImageBitmap(new realm.ImageData(1, 1)), WIDTH, HEIGHT);
    }],
    ['drawImage from a canvas posing as a video', (context, realm): void => {
        const source = realm.document.createElement('canvas');
        source.width = 1;
        source.height = 1;
        Object.setPrototypeOf(source, realm.HTMLVideoElement.prototype);
        context.drawImage(source, WIDTH, HEIGHT);
    }],
];

const inert: [string, Draw][] = [
    ['state and transforms', (context): void => {
        context.save();
        context.setTransform(1, 0.2, 0.3, 1, 4, 5);
        context.rotate(1);
        context.restore();
        context.setLineDash([1, 2]);
        context.getLineDash();
    }],
    ['path building and queries', (context): void => {
        context.beginPath();
        context.moveTo(1, 1);
        context.lineTo(8, 9);
        context.arc(8, 8, 4, 0, Math.PI);
        context.bezierCurveTo(1, 2, 3, 4, 5, 6);
        context.rect(0, 0, 4, 4);
        context.closePath();
        context.isPointInPath(1, 1);
        context.isPointInStroke(1, 1);
    }],
    ['styles and measurement', (context): void => {
        context.fillStyle = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
        context.strokeStyle = context.createPattern(context.canvas, 'repeat')!;
        context.font = '12px serif';
        context.measureText('Cwm fjordbank glyphs vext quiz');
    }],
    ['clearRect', (context): void => context.clearRect(0, 0, 0, 0)],
    ['image data round trip', (context): void => {
        context.putImageData(context.getImageData(0, 0, WIDTH, HEIGHT), 0, 0);
        context.createImageData(2, 2);
    }],
    ['drawImage from a video', (context, realm): void => {
        context.drawImage(realm.document.createElement('video'), 0, 0);
    }],
];

describe('canvas draw tracking', () => {
    test('keeps canvases without rendering native in all three readouts', async () => {
        await withRealm(async (realm) => {
            const installed = install(realm);
            const context = createFilled(realm);
            expect(readoutKind(context, installed)).toBe('native');
            expect(context.canvas.toDataURL()).toBe(Reflect.apply(installed.toDataURL, context.canvas, []));
            expect(await blobBytes(realm.HTMLCanvasElement.prototype.toBlob, context.canvas)).toEqual(
                await blobBytes(installed.toBlob, context.canvas),
            );
        });
    });

    test.each(rendering)('protects a canvas after %s', async (_name, draw) => {
        await withRealm(async (realm) => {
            const installed = install(realm);
            const context = createFilled(realm);
            const untouched = createFilled(realm);
            await draw(context, realm);
            expect(readoutKind(context, installed)).toBe('noised');
            expect(context.canvas.toDataURL()).not.toBe(Reflect.apply(installed.toDataURL, context.canvas, []));
            expect(await blobBytes(realm.HTMLCanvasElement.prototype.toBlob, context.canvas)).not.toEqual(
                await blobBytes(installed.toBlob, context.canvas),
            );
            expect(readoutKind(untouched, installed)).toBe('native');
        });
    });

    test.each(inert)('keeps a canvas native after %s', async (_name, draw) => {
        await withRealm(async (realm) => {
            const installed = install(realm);
            const context = createFilled(realm);
            await draw(context, realm);
            expect(readoutKind(context, installed)).toBe('native');
            expect(context.canvas.toDataURL()).toBe(Reflect.apply(installed.toDataURL, context.canvas, []));
        });
    });

    test('keeps the mark after the canvas is cleared and resized', async () => {
        await withRealm((realm) => {
            const installed = install(realm);
            const context = createFilled(realm);
            context.fillRect(0, 0, 0, 0);
            const image = context.getImageData(0, 0, WIDTH, HEIGHT);
            context.canvas.width = WIDTH;
            Reflect.apply(realm.CanvasRenderingContext2D.prototype.putImageData, context, [
                Reflect.apply(installed.read, createFilled(realm), [0, 0, WIDTH, HEIGHT]), 0, 0,
            ]);
            expect(image.width).toBe(WIDTH);
            expect(readoutKind(context, installed)).toBe('noised');
        });
    });

    test('protects rendering made while a readout converts its arguments', async () => {
        await withRealm((realm) => {
            const installed = install(realm);
            const raw = createFilled(realm);
            const native: ImageData = Reflect.apply(installed.read, raw, [0, 0, WIDTH, HEIGHT]);
            const origin = { valueOf: (): number => { raw.fillRect(0, 0, 0, 0); return 0; } };
            expect(Array.from(raw.getImageData(origin as unknown as number, 0, WIDTH, HEIGHT).data)).toEqual(
                Array.from(referenceSourceNoise(native, installed.seed)),
            );
            const exported = createFilled(realm);
            const nativeURL = Reflect.apply(installed.toDataURL, exported.canvas, []);
            const type = { toString: (): string => { exported.fillRect(0, 0, 0, 0); return 'image/png'; } };
            expect(exported.canvas.toDataURL(type as unknown as string)).not.toBe(nativeURL);
        });
    });

    test('treats methods outside the inert list as rendering', async () => {
        await withRealm((realm) => {
            const prototype = realm.CanvasRenderingContext2D.prototype as unknown as Record<string, Function>;
            prototype.futureDraw = realm.eval('(function futureDraw() { return 7; })');
            const installed = install(realm);
            const context = createFilled(realm) as CanvasRenderingContext2D & { futureDraw(): number };
            expect(readoutKind(context, installed)).toBe('native');
            expect(context.futureDraw()).toBe(7);
            expect(readoutKind(context, installed)).toBe('noised');
        });
    });

    test('hooks only non-inert methods and keeps their native surface', async () => {
        await withRealm((realm) => {
            const context2d = realm.CanvasRenderingContext2D.prototype as unknown as Record<string, Function>;
            const methods = Object.getOwnPropertyNames(context2d).filter((name) => (
                name !== 'constructor' && typeof Object.getOwnPropertyDescriptor(context2d, name)!.value === 'function'
            ));
            const before = new Map(methods.map((name) => [name, context2d[name]]));
            const descriptors = new Map(methods.map((name) => (
                [name, Object.getOwnPropertyDescriptor(context2d, name)!]
            )));
            const nativeToString = realm.Function.prototype.toString;
            const failure = (method: Function): string => {
                try {
                    Reflect.apply(method, {}, []);
                } catch (error) {
                    expect(error).toBeInstanceOf(realm.TypeError);
                    return (error as Error).message;
                }
                throw new Error('Expected an illegal invocation');
            };
            install(realm);
            const hooked = methods.filter((name) => context2d[name] !== before.get(name));
            expect(hooked.sort()).toEqual(
                methods.filter((name) => INERT_CONTEXT_METHODS[name] !== true || name === 'getImageData').sort(),
            );
            expect(hooked).toEqual(expect.arrayContaining([
                'fillRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText', 'drawImage',
            ]));
            hooked.forEach((name) => {
                const method = context2d[name];
                const native = before.get(name)!;
                expect(method).not.toBe(native);
                expect(method.name).toBe(name);
                expect(method.length).toBe(native.length);
                expect(method.toString()).toBe(Reflect.apply(nativeToString, native, []));
                expect(failure(method)).toBe(failure(native));
                expect(() => realm.Reflect.construct(method, [])).toThrow(realm.TypeError);
            });
            hooked.forEach((name) => {
                const descriptor = Object.getOwnPropertyDescriptor(context2d, name)!;
                expect({ ...descriptor, value: undefined }).toEqual({ ...descriptors.get(name)!, value: undefined });
            });
        });
    });
});
