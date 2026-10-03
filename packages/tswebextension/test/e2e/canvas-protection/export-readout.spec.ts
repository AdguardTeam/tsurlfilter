/* Sequential calls exercise repeated snapshots and native callback ordering on the same bitmap. */
/* eslint-disable no-await-in-loop */
import { describe, expect, test } from 'vitest';

import { createCanvasFixtures } from './fixtures';
import { type CanvasRealmPair, withCanvasRealmPair } from './native-reference';
import { referenceSourceNoise } from './noise-reference';

type Realm = Window & typeof globalThis;
type ExportMethod = 'toDataURL' | 'toBlob';
const methods: readonly ExportMethod[] = ['toDataURL', 'toBlob'];

/**
 * Reads the original bitmap through the captured browser binding.
 *
 * @param pair Isolated realm pair.
 * @param context Original context.
 * @param protectedRealm Whether this context belongs to the protected document.
 *
 * @returns Unmodified browser pixels.
 */
const originalPixels = (
    pair: CanvasRealmPair,
    context: CanvasRenderingContext2D,
    protectedRealm: boolean,
): number[] => {
    const native = protectedRealm ? pair.protectedIntrinsics : pair.nativeIntrinsics;
    return Array.from(Reflect.apply(native.getImageData, context, [
        0, 0, context.canvas.width, context.canvas.height,
    ]).data);
};

/**
 * Encodes once with the selected public API and preserves its callback result.
 *
 * @param canvas Original canvas.
 * @param method Selected API.
 * @param args Type and quality arguments.
 *
 * @returns Encoded data, including native null results.
 */
const encode = async (
    canvas: HTMLCanvasElement,
    method: ExportMethod,
    args: unknown[] = [],
): Promise<string | Blob | null> => {
    if (method === 'toDataURL') {
        return Reflect.apply(canvas.toDataURL, canvas, args);
    }
    return new Promise((resolve) => {
        Reflect.apply(canvas.toBlob, canvas, [resolve, ...args]);
    });
};

/**
 * Reads the exact native serializer output, including color profile metadata.
 *
 * @param result Encoded data URL or Blob.
 *
 * @returns The serialized bytes.
 */
const exportBytes = async (result: string | Blob | null): Promise<number[]> => {
    const blob = typeof result === 'string' ? await (await fetch(result)).blob() : result!;
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
};

/**
 * Decodes a browser PNG without passing through protected raw readout hooks.
 *
 * @param result Native export result.
 * @param realm Document owning the decoder.
 * @param native Captured document bindings.
 *
 * @returns The native decoded bitmap.
 */
const decode = async (
    result: string | Blob | null,
    realm: Realm,
    native: CanvasRealmPair['nativeIntrinsics'],
): Promise<ImageData> => {
    const blob = typeof result === 'string' ? await (await fetch(result)).blob() : result!;
    const bitmap = await realm.createImageBitmap(blob);
    try {
        const canvas = realm.document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);
        return Reflect.apply(native.getImageData, context, [0, 0, bitmap.width, bitmap.height]);
    } finally {
        bitmap.close();
    }
};

/**
 * Compares bytes without constructing a large assertion diff for a matching corpus.
 *
 * @param actual Actual pixel buffer.
 * @param expected Expected pixel buffer.
 */
const expectPixels = (actual: ArrayLike<number>, expected: ArrayLike<number>): void => {
    expect(actual.length).toBe(expected.length);
    expect(Array.from(actual).every((value, index) => value === expected[index])).toBe(true);
};

/**
 * Verifies the reference transform changes only one opaque RGB channel by one level.
 *
 * @param source Native source pixels.
 * @param data Independent expected protected pixels.
 */
const expectSourceNoise = (source: ImageData, data: Uint8ClampedArray): void => {
    for (let offset = 0; offset < data.length; offset += 4) {
        expect(data[offset + 3]).toBe(source.data[offset + 3]);
        const changed = [0, 1, 2].filter((channel) => data[offset + channel] !== source.data[offset + channel]);
        if (source.data[offset + 3] !== 255) {
            expect(changed).toHaveLength(0);
        } else {
            expect(changed.length).toBeLessThanOrEqual(1);
            changed.forEach((channel) => {
                expect(Math.abs(data[offset + channel] - source.data[offset + channel])).toBe(1);
            });
        }
    }
};

/**
 * Returns the exact thrown value without formatting it or reading its properties.
 *
 * @param invoke Operation expected to throw.
 *
 * @returns The original thrown value.
 *
 * @throws When the operation unexpectedly succeeds.
 */
const thrown = (invoke: () => unknown): unknown => {
    try {
        invoke();
    } catch (error) {
        return error;
    }
    throw new Error('Expected native exception');
};

/**
 * Compares error constructors in their actual isolated document realms.
 *
 * @param reference Native exception.
 * @param actual Protected exception.
 * @param pair Corresponding document realms.
 */
const expectError = (reference: unknown, actual: unknown, pair: CanvasRealmPair): void => {
    expect(actual).not.toBeUndefined();
    const source = reference as Error;
    const result = actual as Error;
    expect(result.name).toBe(source.name);
    expect(result.message).toBe(source.message);
    const category = [
        [pair.native.TypeError, pair.protected.TypeError],
        [pair.native.DOMException, pair.protected.DOMException],
    ].find(([constructor]) => source.constructor === constructor);
    if (category) {
        expect(Object.getPrototypeOf(source)).toBe(category[0].prototype);
        expect(result.constructor).toBe(category[1]);
        expect(Object.getPrototypeOf(result)).toBe(category[1].prototype);
        return;
    }
    // Firefox exposes native serializer failures as realm-owned XPCOM Exception objects.
    const prototypes = [pair.native, pair.protected].map((realm, index) => {
        const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
        const canvas = realm.document.createElement('canvas');
        canvas.width = 32768;
        canvas.height = 1;
        const gl = canvas.getContext('webgl')!;
        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const exception = thrown(() => Reflect.apply(native.toBlob, canvas, [(): never => {
            throw new Error('Unexpected native failure callback');
        }]));
        expect((exception as Error).name).toBe(source.name);
        expect((exception as Error).constructor).toBe(realm.Object);
        const prototype = Object.getPrototypeOf(exception);
        expect(Object.getPrototypeOf(prototype)).toBe(realm.Object.prototype);
        return prototype;
    });
    expect(source.constructor).toBe(pair.native.Object);
    expect(result.constructor).toBe(pair.protected.Object);
    expect(Object.getPrototypeOf(source)).toBe(prototypes[0]);
    expect(Object.getPrototypeOf(result)).toBe(prototypes[1]);
};

/**
 * Checks the error of an object type whose conversion yields no string. The wrapper converts
 * object types itself, so the error is a TypeError without the browser binding's message prefix.
 *
 * @param actual Value thrown by the protected export.
 */
const expectConversionError = (actual: unknown): void => {
    expect((actual as Error).name).toBe('TypeError');
};

type Brand = 'Date' | 'Object';
interface TypeCase {
    readonly brand: Brand;
    readonly exotic: boolean;
    readonly proxy: boolean;
    readonly method: ExportMethod;
}

const typeCases: TypeCase[] = methods.flatMap((method) => ([
    { brand: 'Object', exotic: false, proxy: false },
    { brand: 'Object', exotic: true, proxy: false },
    { brand: 'Date', exotic: false, proxy: true },
    { brand: 'Date', exotic: true, proxy: true },
] as const).map((type) => ({ method, ...type })));

describe('canvas export conversion and diagnostic boundaries', () => {
    test.for(typeCases)(
        'successful $method $brand exotic=$exotic proxy=$proxy remains protected',
        async (configuration) => withCanvasRealmPair(async (pair) => {
            const outputs: ImageData[] = [];
            const logs: string[][] = [[], []];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const context = createCanvasFixtures(1)[0].draw(realm);
                const factories: Record<Brand, () => object> = {
                    Date: (): object => new realm.Date(0),
                    Object: (): object => ({}),
                };
                const target = factories[configuration.brand]();
                let original: object;
                const property = configuration.exotic ? realm.Symbol.toPrimitive : 'toString';
                realm.Object.defineProperty(target, property, {
                    value(this: unknown, hint?: string): string {
                        logs[index].push(`convert:${this === original}:${hint ?? 'ordinary'}`);
                        return 'image/png';
                    },
                });
                realm.Object.freeze(target);
                original = configuration.proxy ? new realm.Proxy(target, {}) : target;
                const result = await encode(context.canvas, configuration.method, [original]);
                const intrinsics = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                outputs.push(await decode(result, realm, intrinsics));
                if (index === 1) {
                    expectPixels(outputs[1].data, context.getImageData(0, 0, 32, 24).data);
                }
            }
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual([`convert:true:${configuration.exotic ? 'string' : 'ordinary'}`]);
            expect(Array.from(outputs[1].data).some((value, index) => value !== outputs[0].data[index])).toBe(true);
            expect(pair.nativeExports.protected[configuration.method]).toBe(1);
        }),
    );

    test.each(methods)('preserves arbitrary and foreign conversion throws for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const exception of [undefined, null, Symbol('original'), 42n, 'original',
                Object.freeze({ original: true }), new pair.native.URIError('foreign')]) {
                const callbacks: unknown[] = [];
                for (const realm of [pair.native, pair.protected]) {
                    const canvas = realm.document.createElement('canvas');
                    let calls = 0;
                    const type = Object.freeze({
                        toString(): never {
                            calls += 1;
                            // Arbitrary page-thrown primitives must preserve their exact identity.
                            // eslint-disable-next-line @typescript-eslint/no-throw-literal
                            throw exception;
                        },
                    });
                    const callback = (): void => { callbacks.push(null); };
                    expect(thrown(() => Reflect.apply(canvas[method], canvas, method === 'toBlob'
                        ? [callback, type] : [type]))).toBe(exception);
                    expect(calls).toBe(1);
                }
                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(callbacks).toHaveLength(0);
            }
        });
    });
});

describe('canvas export readouts', () => {
    test.for(methods.flatMap((method) => ['x', 'y'].flatMap((axis) => (
        [64, 32767].map((length) => ({ method, axis, length }))
    ))))('protects ordinary existing 2D owners: $method $axis $length', async ({ method, axis, length }) => {
        await withCanvasRealmPair(async (pair) => {
            const realm = pair.protected;
            const canvas = realm.document.createElement('canvas');
            canvas.width = axis === 'x' ? length : 1;
            canvas.height = axis === 'y' ? length : 1;
            const context = canvas.getContext('2d')!;
            context.fillStyle = '#234567';
            context.fillRect(0, 0, canvas.width, canvas.height);
            const before = Reflect.apply(pair.protectedIntrinsics.getImageData, context, [
                0, 0, canvas.width, canvas.height,
            ]) as ImageData;
            const expected = referenceSourceNoise(before, pair.seed);
            expectSourceNoise(before, expected);
            expect(Array.from(expected).some((value, offset) => value !== before.data[offset])).toBe(true);
            const result = await decode(await encode(canvas, method), realm, pair.protectedIntrinsics);
            expect([result.width, result.height]).toEqual([canvas.width, canvas.height]);
            expectPixels(result.data, expected);
            expectPixels(context.getImageData(0, 0, canvas.width, canvas.height).data, expected);
            expectPixels(originalPixels(pair, context, true), before.data);
            expect(canvas.getContext('2d')).toBe(context);
            expect(context.fillStyle).toBe('#234567');
            expect(pair.nativeExports.protected[method]).toBe(1);
        });
    });

    test.each(methods)('keeps oversized MIME and quality selections native for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const axis of ['x', 'y']) {
                for (const mode of ['default', 'p3', 'float16']) {
                    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'invalid/type']) {
                        const outputs: (string | Blob | null)[] = [];
                        const qualityHooks = { count: 0 };
                        for (const realm of [pair.native, pair.protected]) {
                            const canvas = realm.document.createElement('canvas');
                            canvas.width = axis === 'x' ? 32768 : 1;
                            canvas.height = axis === 'y' ? 32768 : 1;
                            const settings = mode === 'float16' ? { colorType: 'float16' } : {};
                            if (mode === 'p3') {
                                Object.assign(settings, { colorSpace: 'display-p3' });
                            }
                            const context = canvas.getContext('2d', settings as CanvasRenderingContext2DSettings)!;
                            context.fillStyle = '#234567';
                            context.fillRect(0, 0, axis === 'x' ? 32768 : 1, axis === 'y' ? 32768 : 1);
                            const quality = realm.Object(0.5);
                            realm.Object.defineProperty(quality, realm.Symbol.toPrimitive, {
                                value: (): never => { qualityHooks.count += 1; throw new Error('quality is any'); },
                            });
                            outputs.push(await encode(canvas, method, [mime, quality]));
                        }
                        expect(qualityHooks.count).toBe(0);
                        if (outputs[0] === null || outputs[0] === 'data:,') {
                            expect(outputs[1]).toBe(outputs[0]);
                        } else {
                            expect(await exportBytes(outputs[1])).toEqual(await exportBytes(outputs[0]));
                        }
                    }
                }
            }
            expect(pair.nativeExports.protected[method]).toBe(pair.nativeExports.native[method]);
        });
    });

    test.each(methods)('preserves original drawing state and existing paths for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const contexts = [pair.native, pair.protected].map((realm) => createCanvasFixtures(1)[0].draw(realm));
            const states = contexts.map((context) => ({
                fillStyle: context.fillStyle,
                globalAlpha: context.globalAlpha,
                lineWidth: context.lineWidth,
                transform: Array.from(context.getTransform().toFloat64Array()),
            }));
            for (const [index, context] of contexts.entries()) {
                const before = originalPixels(pair, context, index === 1);
                await encode(context.canvas, method);
                expect(originalPixels(pair, context, index === 1)).toEqual(before);
                expect({
                    fillStyle: context.fillStyle,
                    globalAlpha: context.globalAlpha,
                    lineWidth: context.lineWidth,
                    transform: Array.from(context.getTransform().toFloat64Array()),
                }).toEqual(states[index]);
                context.stroke();
                context.fillRect(8, 9, 3, 4);
            }
            expect(originalPixels(pair, contexts[1], true)).toEqual(originalPixels(pair, contexts[0], false));
        });
    });

    test.each(methods)('ignores extra arguments and keeps call and apply entry points for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const context = createCanvasFixtures(1)[0].draw(pair.protected);
            const reference = context.getImageData(0, 0, 32, 24);
            let hooks = 0;
            const ignored = { [Symbol.toPrimitive](): never { hooks += 1; throw new Error('extra argument'); } };
            for (const entry of ['call', 'apply'] as const) {
                const invoke = pair.protected.Function.prototype[entry];
                const callable = context.canvas[method];
                let output: string | Blob | null;
                if (method === 'toDataURL') {
                    const args = ['image/png', undefined, ignored];
                    output = Reflect.apply(
                        invoke,
                        callable,
                        entry === 'call' ? [context.canvas, ...args] : [context.canvas, args],
                    );
                } else {
                    output = await new Promise<Blob | null>((resolve) => {
                        const args = [resolve, 'image/png', undefined, ignored];
                        Reflect.apply(
                            invoke,
                            callable,
                            entry === 'call' ? [context.canvas, ...args] : [context.canvas, args],
                        );
                    });
                }
                expectPixels((await decode(output, pair.protected, pair.protectedIntrinsics)).data, reference.data);
            }
            expect(hooks).toBe(0);
            expect(pair.nativeExports.protected[method]).toBe(2);
        });
    });

    test.each(createCanvasFixtures(6))('agrees between decoded PNG full and partial readouts %#', async (fixture) => {
        await withCanvasRealmPair(async (pair) => {
            const context = fixture.draw(pair.protected);
            const image = Reflect.apply(pair.protectedIntrinsics.getImageData, context, [
                0, 0, fixture.width, fixture.height,
            ]) as ImageData;
            for (let offset = 3; offset < image.data.length; offset += 4) {
                image.data[offset] = 255;
            }
            context.putImageData(image, 0, 0);
            const unchanged = originalPixels(pair, context, true);
            let observedChange = false;
            for (let repeat = 0; repeat < 3; repeat += 1) {
                const full = context.getImageData(0, 0, fixture.width, fixture.height);
                const partial = context.getImageData(3, 4, fixture.width - 7, fixture.height - 8);
                for (const method of methods) {
                    const encoded = await encode(context.canvas, method);
                    const decoded = await decode(encoded, pair.protected, pair.protectedIntrinsics);
                    expectPixels(decoded.data, full.data);
                    for (let y = 0; y < partial.height; y += 1) {
                        const start = ((y + 4) * full.width + 3) * 4;
                        expectPixels(
                            partial.data.subarray(y * partial.width * 4, (y + 1) * partial.width * 4),
                            decoded.data.subarray(start, start + partial.width * 4),
                        );
                    }
                }
                observedChange ||= Array.from(full.data).some((value, index) => value !== unchanged[index]);
            }
            expect(observedChange).toBe(true);
            expect(originalPixels(pair, context, true)).toEqual(unchanged);
            expect(pair.nativeExports.protected).toEqual({ toDataURL: 3, toBlob: 3 });
        });
    });

    test.each(methods)('keeps mixed alpha at the native PNG round trip for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const fixture = createCanvasFixtures(3)[2];
            const reference = fixture.draw(pair.native);
            const actual = fixture.draw(pair.protected);
            const before = originalPixels(pair, actual, true);
            const nativeEncoded = await encode(reference.canvas, method);
            const protectedEncoded = await encode(actual.canvas, method);
            const nativeDecoded = await decode(nativeEncoded, pair.native, pair.nativeIntrinsics);
            const protectedDecoded = await decode(protectedEncoded, pair.protected, pair.protectedIntrinsics);
            const full = actual.getImageData(0, 0, fixture.width, fixture.height);
            for (let offset = 0; offset < before.length; offset += 4) {
                expect(protectedDecoded.data[offset + 3]).toBe(nativeDecoded.data[offset + 3]);
                const expected = before[offset + 3] === 255 ? full.data : nativeDecoded.data;
                expectPixels(protectedDecoded.data.subarray(offset, offset + 4), expected.subarray(offset, offset + 4));
            }
            expect(originalPixels(pair, actual, true)).toEqual(before);
        });
    });

    test.each(methods)('does not coerce WebIDL any quality objects for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const realm of [pair.native, pair.protected]) {
                const context = createCanvasFixtures(1)[0].draw(realm);
                let hooks = 0;
                const boxed = new realm.Number(0.1);
                Object.defineProperty(boxed, Symbol.toPrimitive, {
                    value(): never { hooks += 1; throw new Error('quality'); },
                });
                for (const quality of [boxed, {
                    valueOf(): never { hooks += 1; throw new Error('valueOf'); },
                    [Symbol.toPrimitive](): never { hooks += 1; throw new Error('primitive'); },
                }, Symbol('quality'), 1n, null]) {
                    const encoded = await encode(context.canvas, method, ['image/jpeg', quality]);
                    expect(encoded).not.toBeNull();
                }
                expect(hooks).toBe(0);
            }
            expect(pair.nativeExports.protected[method]).toBe(5);
        });
    });

    test.each(methods)('preserves native receiver and type errors for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const receiver of ['plain', 'proxy', 'null'] as const) {
                const errors: unknown[] = [];
                const logs: string[][] = [[], []];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    const canvas = realm.document.createElement('canvas');
                    let target: unknown = null;
                    if (receiver === 'plain') {
                        target = {};
                    } else if (receiver === 'proxy') {
                        target = new realm.Proxy(canvas, {});
                    }
                    const type = { toString(): string { logs[index].push('type'); return 'image/png'; } };
                    errors.push(thrown(() => Reflect.apply(
                        realm.HTMLCanvasElement.prototype[method],
                        target,
                        method === 'toBlob' ? [(): undefined => undefined, type] : [type],
                    )));
                }
                expect(logs[1]).toEqual(logs[0]);
                expectError(errors[0], errors[1], pair);
            }
            for (const type of [Symbol('type')]) {
                const errors: unknown[] = [];
                for (const realm of [pair.native, pair.protected]) {
                    const canvas = realm.document.createElement('canvas');
                    errors.push(thrown(() => Reflect.apply(
                        canvas[method],
                        canvas,
                        method === 'toBlob' ? [(): undefined => undefined, type] : [type],
                    )));
                }
                expectError(errors[0], errors[1], pair);
            }
        });
    });

    test.each(methods)('keeps genuine unsupported color and pixel modes native for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const options of [{ colorSpace: 'display-p3' }, { colorType: 'float16' },
                { colorSpace: 'display-p3', colorType: 'float16' }]) {
                const results: ImageData[] = [];
                const attributes: (CanvasRenderingContext2DSettings & { colorType?: string })[] = [];
                const raws: ImageData[] = [];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = 32;
                    canvas.height = 24;
                    const context = canvas.getContext('2d', options as CanvasRenderingContext2DSettings)!;
                    context.fillStyle = 'color(srgb 0.27 0.53 0.79)';
                    context.fillRect(0, 0, 32, 24);
                    attributes.push(context.getContextAttributes());
                    raws.push(context.getImageData(0, 0, 32, 24));
                    results.push(await decode(
                        await encode(canvas, method),
                        realm,
                        index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics,
                    ));
                    expect(canvas.getContext('2d')).toBe(context);
                }
                expect(attributes[1]).toEqual(attributes[0]);
                const unsupported = attributes[0].colorSpace !== 'srgb'
                    || (attributes[0].colorType !== undefined && attributes[0].colorType !== 'unorm8');
                expectPixels(results[1].data, unsupported ? results[0].data : raws[1].data);
                if (unsupported) {
                    const rawSupported = raws[0].data instanceof pair.native.Uint8ClampedArray
                        && (raws[0].colorSpace === undefined || raws[0].colorSpace === 'srgb');
                    expect(raws[1].colorSpace).toBe(raws[0].colorSpace);
                    if (rawSupported) {
                        expect(Array.from(raws[1].data)).not.toEqual(Array.from(raws[0].data));
                    } else {
                        expectPixels(raws[1].data, raws[0].data);
                    }
                }
            }
        });
    });

    test.each(methods)('preserves MIME fallback and native lossy quality selection for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const actual = createCanvasFixtures(2)[1].draw(pair.protected);
            const expected = pair.native.document.createElement('canvas');
            expected.width = actual.canvas.width;
            expected.height = actual.canvas.height;
            const expectedContext = expected.getContext('2d')!;
            const pixels = actual.getImageData(0, 0, expected.width, expected.height);
            const expectedBytes = new pair.native.Uint8ClampedArray(pixels.data);
            const expectedImage = new pair.native.ImageData(expectedBytes, pixels.width, pixels.height);
            expectedContext.putImageData(expectedImage, 0, 0);
            for (const type of ['image/jpeg', 'image/webp', 'image/unknown', 'IMAGE/PNG', '', undefined]) {
                for (const quality of [0, 0.1, 0.9, 1, -1, 2, NaN, '0.1', new pair.protected.Number(0.1)]) {
                    const reference = await encode(expected, method, [type, quality]);
                    const result = await encode(actual.canvas, method, [type, quality]);
                    if (typeof reference === 'string') {
                        expect(result).toBe(reference);
                    } else {
                        expect((result as Blob).type).toBe(reference!.type);
                        expectPixels(
                            new Uint8Array(await (result as Blob).arrayBuffer()),
                            new Uint8Array(await reference!.arrayBuffer()),
                        );
                    }
                }
            }
        });
    });

    test.each(methods)('keeps tainted export security errors and conversion order native for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const errors: unknown[] = [];
            const symbolErrors: unknown[] = [];
            const invalidCallbacks: unknown[][] = [[], [], []];
            const logs: string[][] = [[], []];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 4;
                canvas.height = 3;
                const context = canvas.getContext('2d')!;
                const image = new realm.Image();
                const fixturePath = './taint.svg';
                const url = new URL(fixturePath, import.meta.url);
                expect(url.protocol).toBe('http:');
                url.pathname = `/@fs${url.pathname}`;
                url.hostname = window.location.hostname === 'localhost' ? '[::1]' : 'localhost';
                await new Promise<void>((resolve, reject) => {
                    image.onload = (): void => resolve();
                    image.onerror = (): void => reject(new Error(`Cannot load taint fixture ${url.href}`));
                    image.src = url.href;
                });
                context.drawImage(image, 0, 0);
                const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                expect((thrown(() => Reflect.apply(native.getImageData, context, [0, 0, 4, 3])) as Error).name)
                    .toBe('SecurityError');
                const type = { toString(): string { logs[index].push('type'); return 'image/png'; } };
                errors.push(thrown(() => Reflect.apply(
                    canvas[method],
                    canvas,
                    method === 'toBlob' ? [(): void => { logs[index].push('callback'); }, type] : [type],
                )));
                let symbolConversions = 0;
                const symbolType = {
                    [Symbol.toPrimitive](): symbol {
                        symbolConversions += 1;
                        return Symbol('tainted type');
                    },
                };
                symbolErrors.push(thrown(() => Reflect.apply(
                    canvas[method],
                    canvas,
                    method === 'toBlob' ? [(): void => { throw new Error('Unexpected callback'); }, symbolType]
                        : [symbolType],
                )));
                expect(symbolConversions).toBe(1);
                if (method === 'toBlob') {
                    const bad = thrown(() => Reflect.apply(canvas.toBlob, canvas, [null, type]));
                    expect((bad as Error).name).toBe('TypeError');
                    [undefined, 'image/png', Symbol('type')].forEach((primitive, typeIndex) => {
                        const error = thrown(() => Reflect.apply(canvas.toBlob, canvas, [null, primitive]));
                        invalidCallbacks[typeIndex].push(error);
                    });
                }
                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(logs[index]).toEqual(['type']);
                expect(canvas.getContext('2d')).toBe(context);
            }
            expectError(errors[0], errors[1], pair);
            expectConversionError(symbolErrors[1]);
            if (method === 'toBlob') {
                invalidCallbacks.forEach(([reference, actual]) => expectError(reference, actual, pair));
            }
        });
    });

    test('keeps toBlob asynchronous with one native callback and call-time snapshot', async () => {
        await withCanvasRealmPair(async (pair) => {
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const context = createCanvasFixtures(1)[0].draw(realm);
                const before = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
                const log = ['call'];
                let callbacks = 0;
                let returned: unknown;
                const blob = await new Promise<Blob | null>((resolve) => {
                    returned = context.canvas.toBlob((result) => {
                        callbacks += 1;
                        log.push('callback');
                        context.getImageData(0, 0, 1, 1);
                        resolve(result);
                    });
                    log.push('return');
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
                    queueMicrotask(() => log.push('microtask'));
                });
                expect(returned).toBeUndefined();
                expect(callbacks).toBe(1);
                expect(log).toEqual(['call', 'return', 'microtask', 'callback']);
                const intrinsics = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                const decoded = await decode(blob, realm, intrinsics);
                expectPixels(decoded.data, before.data);
            }
            expect(pair.nativeExports.protected.toBlob).toBe(1);
        });
    });

    test('delivers one asynchronous null blob after empty-canvas type conversion', async () => {
        await withCanvasRealmPair(async (pair) => {
            const logs: string[][] = [[], []];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 0;
                let callbacks = 0;
                let returned: unknown;
                logs[index].push('call');
                const type = { toString(): string { logs[index].push('type'); return 'image/png'; } };
                const blob = await new Promise<Blob | null>((resolve) => {
                    returned = Reflect.apply(canvas.toBlob, canvas, [(result: Blob | null): void => {
                        callbacks += 1;
                        logs[index].push('callback');
                        expect(canvas.toDataURL()).toBe('data:,');
                        resolve(result);
                    }, type]);
                    logs[index].push('return');
                    queueMicrotask(() => logs[index].push('microtask'));
                });
                expect(blob).toBeNull();
                expect(returned).toBeUndefined();
                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(callbacks).toBe(1);
            }
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual(['call', 'type', 'return', 'microtask', 'callback']);
            expect(pair.nativeExports.protected).toEqual({ toBlob: 1, toDataURL: 1 });
        });
    });

    test('preserves callback validation before observable type conversion', async () => {
        await withCanvasRealmPair(async (pair) => {
            for (const callback of [undefined, null, 4, {}, Symbol('callback')]) {
                const errors: unknown[] = [];
                for (const realm of [pair.native, pair.protected]) {
                    const canvas = realm.document.createElement('canvas');
                    let conversions = 0;
                    const type = { toString(): string { conversions += 1; return 'image/png'; } };
                    errors.push(thrown(() => Reflect.apply(canvas.toBlob, canvas, [callback, type])));
                    expect(conversions).toBe(0);
                }
                expectError(errors[0], errors[1], pair);
            }
            const errors = [pair.native, pair.protected].map((realm) => {
                const canvas = realm.document.createElement('canvas');
                return thrown(() => Reflect.apply(canvas.toBlob, canvas, []));
            });
            expectError(errors[0], errors[1], pair);
        });
    });
});
