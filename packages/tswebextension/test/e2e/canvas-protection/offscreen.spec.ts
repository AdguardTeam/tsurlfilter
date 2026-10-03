import { describe, expect, test } from 'vitest';

import {
    HEIGHT,
    install,
    type Installed,
    type Realm,
    WIDTH,
    withRealm,
} from './generated-realm';
import { referenceSourceNoise } from './noise-reference';

/**
 * Native OffscreenCanvas readouts captured before installation.
 */
interface OffscreenNatives extends Installed {
    readonly offscreenRead: OffscreenCanvasRenderingContext2D['getImageData'];
    readonly convertToBlob: OffscreenCanvas['convertToBlob'];
}

const installWithOffscreen = (realm: Realm): OffscreenNatives => {
    const natives = {
        offscreenRead: realm.OffscreenCanvasRenderingContext2D.prototype.getImageData,
        convertToBlob: realm.OffscreenCanvas.prototype.convertToBlob,
    };
    return { ...install(realm), ...natives };
};

/**
 * Creates varied opaque pixels.
 *
 * @param realm Owner of the image.
 *
 * @returns Caller-supplied image bytes.
 */
const createImage = (realm: Realm): ImageData => {
    const image = new realm.ImageData(WIDTH, HEIGHT);
    for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
        image.data.set([(pixel * 13) % 256, (pixel * 47) % 256, (pixel * 101) % 256, 255], pixel * 4);
    }
    return image;
};

/**
 * Fills an OffscreenCanvas through `putImageData`, optionally followed by an empty rendering call.
 *
 * @param realm Canvas owner realm.
 * @param rendered Whether a rendering method is called.
 *
 * @returns Its 2D context.
 */
const createOffscreen = (realm: Realm, rendered: boolean): OffscreenCanvasRenderingContext2D => {
    const context = new realm.OffscreenCanvas(WIDTH, HEIGHT).getContext('2d')!;
    context.putImageData(createImage(realm), 0, 0);
    if (rendered) {
        context.fillRect(0, 0, 0, 0);
    }
    return context;
};

const noised = (realm: Realm, installed: Installed): number[] => (
    Array.from(referenceSourceNoise(createImage(realm), installed.seed))
);

/**
 * Decodes an export in the unprotected test document.
 *
 * @param input Data URL or encoded image.
 *
 * @returns Decoded RGBA bytes.
 */
const decode = async (input: string | Blob): Promise<number[]> => {
    const blob = typeof input === 'string' ? await (await fetch(input)).blob() : input;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
};

const bytes = async (blob: Blob): Promise<number[]> => Array.from(new Uint8Array(await blob.arrayBuffer()));

describe('canvas protection of OffscreenCanvas in a document', () => {
    test('keeps an OffscreenCanvas without rendering native', async () => {
        await withRealm(async (realm) => {
            const installed = installWithOffscreen(realm);
            const context = createOffscreen(realm, false);
            expect(Array.from(context.getImageData(0, 0, WIDTH, HEIGHT).data)).toEqual(
                Array.from(createImage(realm).data),
            );
            expect(await bytes(await context.canvas.convertToBlob())).toEqual(
                await bytes(await Reflect.apply(installed.convertToBlob, context.canvas, [])),
            );
        });
    });

    test('protects the raw readout and the encoded export of a drawn-on OffscreenCanvas', async () => {
        await withRealm(async (realm) => {
            const installed = installWithOffscreen(realm);
            const context = createOffscreen(realm, true);
            const native: ImageData = Reflect.apply(installed.offscreenRead, context, [0, 0, WIDTH, HEIGHT]);
            expect(Array.from(native.data)).toEqual(Array.from(createImage(realm).data));
            expect(Array.from(context.getImageData(0, 0, WIDTH, HEIGHT).data)).toEqual(noised(realm, installed));
            expect(Array.from(context.getImageData(8, 4, 16, 8).data)).toEqual(
                Array.from({ length: 8 }, (_row, y) => (
                    noised(realm, installed).slice(((y + 4) * WIDTH + 8) * 4, ((y + 4) * WIDTH + 24) * 4)
                )).flat(),
            );
            expect(await decode(await context.canvas.convertToBlob())).toEqual(noised(realm, installed));
            const jpeg = await context.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
            expect(jpeg.type).toBe('image/jpeg');
            const nativeJpeg: Blob = await Reflect.apply(installed.convertToBlob, context.canvas, [
                { type: 'image/jpeg', quality: 0.9 },
            ]);
            expect(await bytes(jpeg)).not.toEqual(await bytes(nativeJpeg));
        });
    });

    test('protects rendering made while convertToBlob reads its options', async () => {
        await withRealm(async (realm) => {
            const installed = installWithOffscreen(realm);
            const context = createOffscreen(realm, false);
            const log: string[] = [];
            const options = {
                get quality(): number { log.push('quality'); return 1; },
                get type(): string { log.push('type'); context.fillRect(0, 0, 0, 0); return 'image/png'; },
            };
            expect(await decode(await context.canvas.convertToBlob(options))).toEqual(noised(realm, installed));
            expect(log).toEqual(['quality', 'type']);
        });
    });

    test('protects a drawn-on canvas copied through an ImageBitmap', async () => {
        await withRealm(async (realm) => {
            const installed = installWithOffscreen(realm);
            const source = realm.document.createElement('canvas');
            source.width = WIDTH;
            source.height = HEIGHT;
            const sourceContext = source.getContext('2d')!;
            sourceContext.putImageData(createImage(realm), 0, 0);
            sourceContext.fillRect(0, 0, 0, 0);
            const copy = new realm.OffscreenCanvas(WIDTH, HEIGHT).getContext('2d')!;
            copy.drawImage(await realm.createImageBitmap(source), 0, 0);
            expect(Array.from(copy.getImageData(0, 0, WIDTH, HEIGHT).data)).toEqual(noised(realm, installed));
            const rendered = realm.document.createElement('canvas');
            rendered.width = WIDTH;
            rendered.height = HEIGHT;
            rendered.getContext('bitmaprenderer')!.transferFromImageBitmap(await realm.createImageBitmap(source));
            expect(await decode(rendered.toDataURL())).toEqual(noised(realm, installed));
            const offscreen = new realm.OffscreenCanvas(WIDTH, HEIGHT);
            offscreen.getContext('bitmaprenderer')!.transferFromImageBitmap(await realm.createImageBitmap(source));
            expect(await decode(await offscreen.convertToBlob())).toEqual(noised(realm, installed));
        });
    });

    test('protects the HTML canvas behind a transferred OffscreenCanvas', async () => {
        await withRealm(async (realm) => {
            const installed = installWithOffscreen(realm);
            const placeholder = realm.document.createElement('canvas');
            placeholder.width = WIDTH;
            placeholder.height = HEIGHT;
            realm.document.body.appendChild(placeholder);
            const context = placeholder.transferControlToOffscreen().getContext('2d')!;
            context.putImageData(createImage(realm), 0, 0);
            context.fillRect(0, 0, 0, 0);
            expect(Array.from(context.getImageData(0, 0, WIDTH, HEIGHT).data)).toEqual(noised(realm, installed));
            const original = Array.from(createImage(realm).data);
            let committed: number[] = [];
            for (let attempt = 0; attempt < 20 && committed.join() !== original.join(); attempt += 1) {
                // eslint-disable-next-line no-await-in-loop -- Wait for the transferred frame to reach its canvas.
                await new Promise<void>((resolve) => { realm.requestAnimationFrame(() => resolve()); });
                // eslint-disable-next-line no-await-in-loop -- Read the committed frame through the native export.
                committed = await decode(Reflect.apply(installed.toDataURL, placeholder, []));
            }
            expect(committed).toEqual(original);
            expect(await decode(placeholder.toDataURL())).toEqual(noised(realm, installed));
        });
    });

    test('protects an OffscreenCanvas created in an inherited frame', async () => {
        await withRealm((realm) => {
            const installed = installWithOffscreen(realm);
            const frame = realm.document.createElement('iframe');
            realm.document.body.appendChild(frame);
            const context = createOffscreen(frame.contentWindow as Realm, true);
            expect(Array.from(context.getImageData(0, 0, WIDTH, HEIGHT).data)).toEqual(noised(realm, installed));
        });
    });

    test('keeps the native surface of the OffscreenCanvas hooks', async () => {
        await withRealm(async (realm) => {
            const members = (): Function[] => [
                realm.OffscreenCanvasRenderingContext2D.prototype.getImageData,
                realm.OffscreenCanvasRenderingContext2D.prototype.fillText,
                realm.OffscreenCanvasRenderingContext2D.prototype.drawImage,
                realm.OffscreenCanvas.prototype.convertToBlob,
                realm.ImageBitmapRenderingContext.prototype.transferFromImageBitmap,
                realm.HTMLCanvasElement.prototype.transferControlToOffscreen,
            ];
            const natives = members();
            const nativeToString = realm.Function.prototype.toString;
            const outcome = async (method: Function): Promise<string> => {
                try {
                    await Reflect.apply(method, {}, []);
                } catch (error) {
                    expect(error).toBeInstanceOf(realm.TypeError);
                    return (error as Error).message;
                }
                throw new Error('Expected an illegal invocation');
            };
            install(realm);
            const hooked = members();
            for (const [index, method] of hooked.entries()) {
                expect(method).not.toBe(natives[index]);
                expect(method.name).toBe(natives[index].name);
                expect(method.length).toBe(natives[index].length);
                expect(method.toString()).toBe(Reflect.apply(nativeToString, natives[index], []));
                // eslint-disable-next-line no-await-in-loop -- Compared one method at a time.
                expect(await outcome(method)).toBe(await outcome(natives[index]));
            }
            expect(realm.OffscreenCanvasRenderingContext2D.prototype.lineTo.toString()).toContain('[native code]');
        });
    });
});
