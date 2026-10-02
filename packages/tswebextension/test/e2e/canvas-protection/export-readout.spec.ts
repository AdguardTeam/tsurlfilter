/* Sequential calls exercise repeated snapshots and native callback ordering on the same bitmap. */
/* eslint-disable no-await-in-loop */
import { describe, expect, test } from 'vitest';

import { createCanvasFixtures } from './fixtures';
import { type CanvasRealmPair, withCanvasRealmPair } from './native-reference';
import { referenceSipHash, referenceSourceNoise } from './noise-reference';

type Realm = Window & typeof globalThis;
type ExportMethod = 'toDataURL' | 'toBlob';
const methods: readonly ExportMethod[] = ['toDataURL', 'toBlob'];

/**
 * Browser GPU fixture operations used when a native adapter is available.
 */
interface FixtureGpuDevice {
    readonly queue: {
        submit(commands: object[]): void;
        onSubmittedWorkDone(): Promise<void>;
    };
    createCommandEncoder(): {
        beginRenderPass(descriptor: {
            colorAttachments: {
                view: object;
                clearValue: { r: number; g: number; b: number; a: number };
                loadOp: string;
                storeOp: string;
            }[];
        }): { end(): void };
        finish(): object;
    };
    destroy(): void;
}

/**
 * Native GPU canvas operations needed to populate and retain its existing owner.
 */
interface FixtureGpuContext {
    configure(options: { device: FixtureGpuDevice; format: string; usage: number; alphaMode: string }): void;
    getCurrentTexture(): { createView(): object };
}

/**
 * Native adapter availability is separate from the canvas owner interface.
 */
interface FixtureGpu {
    requestAdapter(): Promise<{ requestDevice(): Promise<FixtureGpuDevice> } | null>;
    getPreferredCanvasFormat(): string;
}

/**
 * A native reference raster retaining its original premultiplied pixel storage.
 */
interface TransferredReferenceRaster {
    readonly canvas: HTMLCanvasElement;
    readonly context: OffscreenCanvasRenderingContext2D;
}

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
 * Waits for the HTML placeholder to publish the test owner's current sRGB bitmap.
 *
 * @param pair Isolated native and protected documents.
 * @param canvas Transferred HTML placeholder.
 * @param context Original Offscreen owner.
 * @param protectedRealm Whether the source belongs to the protected document.
 * @param alphaOnly Whether native color conversion permits comparing only coverage and alpha.
 */
const waitForPlaceholder = async (
    pair: CanvasRealmPair,
    canvas: HTMLCanvasElement,
    context: OffscreenCanvasRenderingContext2D,
    protectedRealm: boolean,
    alphaOnly = false,
): Promise<void> => {
    const realm = protectedRealm ? pair.protected : pair.native;
    const native = protectedRealm ? pair.protectedIntrinsics : pair.nativeIntrinsics;
    const { width, height } = context.canvas;
    const expected = Reflect.apply(native.offscreenGetImageData, context, [
        0, 0, width, height, { colorSpace: 'srgb', pixelFormat: 'rgba-unorm8' },
    ]) as ImageData;
    const copy = realm.document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    const copyContext = copy.getContext('2d')!;
    for (let frame = 0; frame < 8; frame += 1) {
        copyContext.clearRect(0, 0, width, height);
        Reflect.apply(native.drawImage, copyContext, [canvas, 0, 0]);
        const actual = Reflect.apply(native.getImageData, copyContext, [0, 0, width, height]) as ImageData;
        if (canvas.width === width && canvas.height === height
            && Array.from(actual.data).every((value, offset) => (
                (alphaOnly && offset % 4 !== 3) || value === expected.data[offset]
            ))) {
            return;
        }
        await new Promise<void>((resolve) => { realm.requestAnimationFrame(() => resolve()); });
    }
    throw new Error('HTML placeholder did not publish the expected source bitmap');
};

/**
 * Serializes an independently populated transferred source through one captured native call.
 *
 * @param pair Isolated document bindings.
 * @param source Independently observed or constructed source bitmap.
 * @param data Expected source bytes before native serialization.
 * @param method Selected serializer.
 * @param args MIME and unchanged quality.
 * @param raster Native frame-drawn surface whose nonopaque storage must be retained.
 *
 * @returns The native representation of the independently populated source.
 */
const encodeExpectedSource = async (
    pair: CanvasRealmPair,
    source: ImageData,
    data: Uint8ClampedArray,
    method: ExportMethod,
    args: unknown[] = [],
    raster?: TransferredReferenceRaster,
): Promise<string | Blob | null> => {
    const realm = pair.native;
    const native = pair.nativeIntrinsics;
    const canvas = raster?.canvas ?? realm.document.createElement('canvas');
    if (!raster) {
        canvas.width = source.width;
        canvas.height = source.height;
    }
    canvas.style.height = '1px';
    realm.document.body.appendChild(canvas);
    let context: OffscreenCanvasRenderingContext2D;
    if (raster) {
        context = raster.context;
    } else {
        const owner = Reflect.apply(native.transferControlToOffscreen, canvas, []) as OffscreenCanvas;
        context = Reflect.apply(native.offscreenGetContext, owner, ['2d']) as OffscreenCanvasRenderingContext2D;
    }
    const image = new realm.ImageData(new realm.Uint8ClampedArray(data), source.width, source.height);
    if (raster) {
        for (let offset = 0; offset < data.length; offset += 4) {
            if (data[offset + 3] === 255 && [0, 1, 2].some((channel) => (
                data[offset + channel] !== source.data[offset + channel]
            ))) {
                const point = offset / 4;
                Reflect.apply(native.offscreenPutImageData, context, [
                    image, 0, 0, point % source.width, Math.floor(point / source.width), 1, 1,
                ]);
            }
        }
    } else {
        Reflect.apply(native.offscreenPutImageData, context, [image, 0, 0]);
    }
    await waitForPlaceholder(pair, canvas, context, false);
    let calls = 0;
    let callback: ((blob: Blob | null) => void) | undefined;
    const selected = new realm.Proxy(native[method], {
        apply: (target, receiver, parameters): unknown => {
            calls += 1;
            expect(receiver).toBe(canvas);
            if (method === 'toBlob') {
                expect(parameters[0]).toBe(callback);
            }
            return Reflect.apply(target, receiver, parameters);
        },
    });
    try {
        if (method === 'toDataURL') {
            const result = Reflect.apply(selected, canvas, args) as string;
            expect(calls).toBe(1);
            return result;
        }
        let count = 0;
        const order: string[] = [];
        const result = await new Promise<Blob | null>((resolve) => {
            callback = (blob): void => {
                count += 1;
                order.push('callback');
                resolve(blob);
            };
            expect(Reflect.apply(selected, canvas, [callback, ...args])).toBeUndefined();
            order.push('return');
            queueMicrotask(() => order.push('microtask'));
        });
        expect(calls).toBe(1);
        expect(count).toBe(1);
        expect(order).toEqual(['return', 'microtask', 'callback']);
        return result;
    } finally {
        canvas.remove();
    }
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

type Brand = 'Number' | 'String' | 'Boolean' | 'Date' | 'Array' | 'Object';
type Formatter = 'none' | 'toSource' | 'ownKeys' | 'descriptor' | 'array-index';
interface TypeCase {
    readonly brand: Brand;
    readonly exotic: boolean;
    readonly proxy: boolean;
    readonly formatter: Formatter;
    readonly method: ExportMethod;
}

/**
 * Creates a frozen DOMString argument with separate conversion and formatter records.
 *
 * @param configuration Original brand and native formatter effects.
 * @param realm Original argument's realm.
 * @param context Bitmap affected only by page-owned formatting hooks.
 *
 * @returns Original argument, conversion records and the exact formatter exception.
 */
const rejectedType = (configuration: TypeCase, realm: Realm, context: CanvasRenderingContext2D): {
    value: object;
    conversion: string[];
    formatting: string[];
    exception: Error;
} => {
    const conversion: string[] = [];
    const formatting: string[] = [];
    const exception = new realm.URIError('original formatter');
    const factories: Record<Brand, () => object> = {
        Number: (): object => realm.Object(1.8),
        String: (): object => realm.Object('type'),
        Boolean: (): object => realm.Object(true),
        Date: (): object => new realm.Date(0),
        Array: (): object => new realm.Array(1, 2),
        Object: (): object => ({}),
    };
    const target = factories[configuration.brand]();
    let original: object;
    let formattingStarted = false;
    const effect = (tag: string): void => {
        formatting.push(tag);
        context.canvas.width = 2;
        context.canvas.height = 1;
        context.fillStyle = '#c81428';
        context.fillRect(0, 0, 2, 1);
    };
    if (configuration.exotic) {
        realm.Object.defineProperty(target, realm.Symbol.toPrimitive, {
            value(hint: string): object { conversion.push(`primitive:${hint}:${this === original}`); return {}; },
            enumerable: true,
        });
    } else {
        realm.Object.defineProperties(target, {
            [realm.Symbol.toPrimitive]: { value: undefined, enumerable: true },
            toString: {
                value(): object { conversion.push(`toString:${this === original}`); return {}; }, enumerable: true,
            },
            valueOf: {
                value(): object { conversion.push(`valueOf:${this === original}`); return {}; }, enumerable: true,
            },
        });
    }
    if (configuration.formatter === 'toSource') {
        realm.Object.defineProperty(target, 'toSource', {
            get(): () => string {
                formattingStarted = true;
                effect(`toSource:get:${this === original}`);
                return function toSource(this: unknown): string {
                    formatting.push(`toSource:call:${this === original}`);
                    return 'source';
                };
            },
        });
    } else if (configuration.formatter === 'array-index') {
        realm.Object.defineProperty(target, '0', {
            get(): never { formattingStarted = true; effect(`index:get:${this === original}`); throw exception; },
            enumerable: true,
        });
    }
    realm.Object.freeze(target);
    original = configuration.proxy ? new realm.Proxy(target, {
        get: (object, key, receiver): unknown => {
            if (key === 'toSource') { formattingStarted = true; }
            (formattingStarted ? formatting : conversion).push(`get:${String(key)}`);
            return realm.Reflect.get(object, key, receiver);
        },
        ownKeys: (object): (string | symbol)[] => {
            formattingStarted = true;
            formatting.push('ownKeys');
            if (configuration.formatter === 'ownKeys') { effect('ownKeys:draw'); }
            return realm.Reflect.ownKeys(object);
        },
        getOwnPropertyDescriptor: (object, key): PropertyDescriptor | undefined => {
            formattingStarted = true;
            formatting.push(`descriptor:${String(key)}`);
            if (configuration.formatter === 'descriptor') { effect('descriptor:draw'); throw exception; }
            return realm.Reflect.getOwnPropertyDescriptor(object, key);
        },
        getPrototypeOf: (object): object | null => {
            formattingStarted = true;
            formatting.push('prototype');
            return realm.Reflect.getPrototypeOf(object);
        },
    }) : target;
    return {
        value: original, conversion, formatting, exception,
    };
};

const rejectedTypes: TypeCase[] = methods.flatMap((method) => (
    (['Number', 'String', 'Boolean', 'Date', 'Array', 'Object'] as const).flatMap((brand) => (
        [false, true].flatMap((exotic) => [false, true].map((proxy) => ({
            method, brand, exotic, proxy, formatter: 'none' as const,
        })))
    ))
));
methods.forEach((method) => {
    rejectedTypes.push(
        {
            method, brand: 'Object', exotic: false, proxy: false, formatter: 'toSource',
        },
        {
            method, brand: 'Array', exotic: true, proxy: true, formatter: 'ownKeys',
        },
        {
            method, brand: 'Array', exotic: true, proxy: true, formatter: 'descriptor',
        },
        {
            method, brand: 'Array', exotic: true, proxy: false, formatter: 'array-index',
        },
    );
});

describe('canvas export conversion and diagnostic boundaries', () => {
    test.for(rejectedTypes.filter(({ formatter }) => formatter === 'none'))(
        'successful $method $brand exotic=$exotic proxy=$proxy remains protected',
        async (configuration) => withCanvasRealmPair(async (pair) => {
            const outputs: ImageData[] = [];
            const logs: string[][] = [[], []];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const context = createCanvasFixtures(1)[0].draw(realm);
                const factories: Record<Brand, () => object> = {
                    Number: (): object => realm.Object(1.8),
                    String: (): object => realm.Object('type'),
                    Boolean: (): object => realm.Object(true),
                    Date: (): object => new realm.Date(0),
                    Array: (): object => new realm.Array(1, 2),
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
    test.for(rejectedTypes)('$method $brand exotic=$exotic proxy=$proxy formatter=$formatter', async (configuration, {
        annotate,
    }) => withCanvasRealmPair(async (pair) => {
        const contexts = [pair.native, pair.protected].map((realm) => createCanvasFixtures(1)[0].draw(realm));
        const inputs = contexts.map((context, index) => {
            const realm = index === 0 ? pair.native : pair.protected;
            return rejectedType(configuration, realm, context);
        });
        const outcomes: unknown[] = [];
        let callbacks = 0;
        contexts.forEach((context, index) => {
            outcomes.push(thrown(() => Reflect.apply(
                context.canvas[configuration.method],
                context.canvas,
                configuration.method === 'toBlob' ? [(): void => { callbacks += 1; }, inputs[index].value]
                    : [inputs[index].value],
            )));
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(callbacks).toBe(0);
        expect(pair.nativeExports.native[configuration.method]).toBe(1);
        expect(pair.nativeExports.protected[configuration.method]).toBe(1);
        expect(inputs[1].conversion).toEqual(inputs[0].conversion);
        const firefox = pair.native.navigator.userAgent.includes('Firefox/');
        const bitmaps = contexts.map((context, index) => ({
            width: context.canvas.width,
            height: context.canvas.height,
            pixels: originalPixels(pair, context, index === 1),
        }));
        expect(inputs[1].formatting).toEqual(inputs[0].formatting);
        expect(inputs[0].formatting).toEqual([]);
        expect(bitmaps[1]).toEqual(bitmaps[0]);
        if (outcomes[0] === inputs[0].exception) {
            expect(outcomes[1]).toBe(inputs[1].exception);
        } else if (!firefox || configuration.proxy) {
            expectError(outcomes[0], outcomes[1], pair);
        } else {
            expect((outcomes[0] as Error).constructor).toBe(pair.native.TypeError);
            expect(Object.getPrototypeOf(outcomes[0])).toBe(pair.native.TypeError.prototype);
            expect((outcomes[1] as Error).constructor).toBe(pair.protected.TypeError);
            expect(Object.getPrototypeOf(outcomes[1])).toBe(pair.protected.TypeError.prototype);
        }
        if (firefox) {
            await annotate(JSON.stringify({
                permittedRejectedObjectDiagnostics: true,
                reference: {
                    error: { name: (outcomes[0] as Error).name, message: (outcomes[0] as Error).message },
                    effects: inputs[0].formatting,
                    bitmap: { ...bitmaps[0], pixels: bitmaps[0].pixels.slice(0, 8) },
                },
                protected: {
                    error: { name: (outcomes[1] as Error).name, message: (outcomes[1] as Error).message },
                    effects: inputs[1].formatting,
                    bitmap: { ...bitmaps[1], pixels: bitmaps[1].pixels.slice(0, 8) },
                },
            }), 'firefox-rejected-object-export-diagnostic');
        }
    }));

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
            expect(pair.nativeExports.protected[method]).toBe(7);
        });
    });

    test.each(methods)('keeps reentrant conversion snapshots independent for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const context = createCanvasFixtures(1)[0].draw(pair.protected);
            let innerPromise: Promise<string | Blob | null> | undefined;
            const before = context.getImageData(0, 0, 32, 24);
            const type = {
                toString(): string {
                    innerPromise = encode(context.canvas, method);
                    context.resetTransform();
                    context.globalAlpha = 1;
                    context.fillStyle = '#234567';
                    context.fillRect(0, 0, 32, 24);
                    return 'image/png';
                },
            };
            const outer = await encode(context.canvas, method, [type]);
            const inner = await innerPromise!;
            const decodedInner = await decode(inner, pair.protected, pair.protectedIntrinsics);
            const decodedOuter = await decode(outer, pair.protected, pair.protectedIntrinsics);
            expectPixels(decodedInner.data, before.data);
            expectPixels(decodedOuter.data, context.getImageData(0, 0, 32, 24).data);
            expect(pair.nativeExports.protected[method]).toBe(2);
        });
    });

    test('preserves callable callback proxies and primitive callback validation ordering', async () => {
        await withCanvasRealmPair(async (pair) => {
            const logs: string[][] = [[], []];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                const result = await new Promise<Blob | null>((resolve) => {
                    const callback = new realm.Proxy(resolve, {
                        apply: (target, receiver, args): unknown => {
                            logs[index].push(`callback:${args.length}:${args[0] instanceof realm.Blob}`);
                            return realm.Reflect.apply(target, receiver, args);
                        },
                    });
                    canvas.toBlob(callback);
                    logs[index].push('return');
                    queueMicrotask(() => logs[index].push('microtask'));
                });
                expect(result).toBeInstanceOf(realm.Blob);
            }
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual(['return', 'microtask', 'callback:1:true']);
            for (const [width, height] of [[0, 0], [32768, 1]]) {
                for (const type of [undefined, 'image/png', Symbol('type')]) {
                    const exceptions = [pair.native, pair.protected].map((realm) => {
                        const canvas = realm.document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        return thrown(() => Reflect.apply(canvas.toBlob, canvas, [null, type]));
                    });
                    expectError(exceptions[0], exceptions[1], pair);
                }
            }
        });
    });

    test.each(methods)('preserves Symbol rejection before large snapshot preparation for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const width of [32, 32768]) {
                for (const object of [false, true]) {
                    const exceptions: unknown[] = [];
                    const logs: string[][] = [[], []];
                    for (const [index, realm] of [pair.native, pair.protected].entries()) {
                        const canvas = realm.document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = 1;
                        const symbol = Symbol('type');
                        const type = object ? Object.freeze({
                            [Symbol.toPrimitive](hint: string): symbol {
                                logs[index].push(hint);
                                const context = canvas.getContext('2d')!;
                                context.fillStyle = '#234567';
                                context.fillRect(0, 0, width, 1);
                                return symbol;
                            },
                        }) : symbol;
                        exceptions.push(thrown(() => Reflect.apply(canvas[method], canvas, method === 'toBlob'
                            ? [(): void => { throw new Error('Unexpected callback'); }, type] : [type])));
                        expect(canvas.width).toBe(width);
                        expect(canvas.height).toBe(1);
                    }
                    expect(logs[1]).toEqual(logs[0]);
                    expect(logs[0]).toEqual(object ? ['string'] : []);
                    expectError(exceptions[0], exceptions[1], pair);
                }
            }
            expect(pair.nativeExports.protected[method]).toBe(4);
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

    test.for(methods.flatMap((method) => ['webgl', 'webgl2', 'bitmaprenderer'].flatMap((owner) => (
        ['opaque', 'mixed'].map((alpha) => ({ method, owner, alpha }))
    ))))('keeps ordinary non 2D exports original native: $method $owner $alpha', async ({
        method, owner, alpha,
    }, { annotate }) => {
        await withCanvasRealmPair(async (pair) => {
            const outputs: (string | Blob | null)[][] = [[], []];
            const queues: number[][][] = [[], []];
            const availability: boolean[] = [];
            const orders: string[][] = [[], []];
            let qualityHooks = 0;
            const quality = Object.freeze({
                [Symbol.toPrimitive](): never { qualityHooks += 1; throw new Error('Unexpected quality conversion'); },
                valueOf(): never { qualityHooks += 1; throw new Error('Unexpected quality conversion'); },
            });
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 24;
                let gl: WebGLRenderingContext | WebGL2RenderingContext | undefined;
                let bitmap: ImageBitmapRenderingContext | null = null;
                if (owner === 'bitmaprenderer') {
                    bitmap = canvas.getContext('bitmaprenderer');
                    availability.push(bitmap !== null);
                    if (!bitmap) {
                        continue;
                    }
                    const source = realm.document.createElement('canvas');
                    source.width = 32;
                    source.height = 24;
                    const context = source.getContext('2d')!;
                    context.fillStyle = alpha === 'mixed' ? 'rgba(35,69,103,0.5)' : '#234567';
                    context.fillRect(0, 0, 16, 24);
                    context.fillStyle = '#987654';
                    context.fillRect(16, 0, 16, 24);
                    bitmap.transferFromImageBitmap(await realm.createImageBitmap(source));
                } else {
                    gl = canvas.getContext(owner, {
                        preserveDrawingBuffer: true, premultipliedAlpha: false,
                    }) as WebGLRenderingContext | WebGL2RenderingContext | undefined;
                    availability.push(Boolean(gl));
                    if (!gl) {
                        continue;
                    }
                    gl.clearColor(0.13, 0.27, 0.41, alpha === 'mixed' ? 0.5 : 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.enable(gl.SCISSOR_TEST);
                    gl.scissor(16, 0, 16, 24);
                    gl.clearColor(0.75, 0.25, 0.5, 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                }
                let events = 0;
                canvas.addEventListener('webglcontextcreationerror', () => { events += 1; });
                const copy = realm.document.createElement('canvas');
                copy.width = 32;
                copy.height = 24;
                const copyContext = copy.getContext('2d')!;
                const read = (): ImageData => {
                    copyContext.clearRect(0, 0, 32, 24);
                    Reflect.apply(native.drawImage, copyContext, [canvas, 0, 0]);
                    return Reflect.apply(native.getImageData, copyContext, [0, 0, 32, 24]);
                };
                const before = read();
                const state = gl ? {
                    color: Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE)),
                    scissor: Array.from(gl.getParameter(gl.SCISSOR_BOX)),
                    framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
                    attributes: gl.getContextAttributes(),
                } : undefined;
                for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/unknown']) {
                    for (const selectedQuality of [0.25, quality]) {
                        let callbacks = 0;
                        const type = {
                            toString(): string { orders[index].push(`type:${this === type}`); return mime; },
                        };
                        if (gl) {
                            gl.enable(0xbad);
                        }
                        let output: string | Blob | null;
                        let queue: number[] = [];
                        if (method === 'toDataURL') {
                            output = Reflect.apply(canvas.toDataURL, canvas, [type, selectedQuality]);
                        } else {
                            output = await new Promise<Blob | null>((resolve) => {
                                const callback = new realm.Proxy((blob: Blob | null): void => {
                                    callbacks += 1;
                                    orders[index].push('callback');
                                    resolve(blob);
                                }, {});
                                expect(Reflect.apply(canvas.toBlob, canvas, [callback, type, selectedQuality]))
                                    .toBeUndefined();
                                expect(pair.nativeBlobCallbacks[index === 0 ? 'native' : 'protected'].at(-1))
                                    .toBe(callback);
                                orders[index].push('return');
                                if (gl) {
                                    queue = [gl.getError(), gl.getError()];
                                }
                                queueMicrotask(() => orders[index].push('microtask'));
                            });
                        }
                        if (gl && method === 'toDataURL') {
                            queue = [gl.getError(), gl.getError()];
                        }
                        expect(callbacks).toBe(method === 'toBlob' ? 1 : 0);
                        queues[index].push(queue);
                        outputs[index].push(output);
                    }
                }
                expect(events).toBe(0);
                expectPixels(read().data, before.data);
                expect([canvas.width, canvas.height]).toEqual([32, 24]);
                expect(Reflect.apply(native.getContext, canvas, [owner])).toBe(gl ?? bitmap);
                expect(Reflect.apply(native.getContext, canvas, ['2d'])).toBeNull();
                if (gl) {
                    expect(gl.isContextLost()).toBe(false);
                    expect({
                        color: Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE)),
                        scissor: Array.from(gl.getParameter(gl.SCISSOR_BOX)),
                        framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
                        attributes: gl.getContextAttributes(),
                    }).toEqual(state);
                }
            }
            expect(availability[1]).toBe(availability[0]);
            await annotate(JSON.stringify({ owner, alpha, availability }), 'ordinary-native-owner-availability');
            if (!availability[0]) {
                return;
            }
            expect(qualityHooks).toBe(0);
            expect(orders[1]).toEqual(orders[0]);
            expect(queues[1]).toEqual(queues[0]);
            expect(pair.nativeExports.native[method]).toBe(8);
            expect(pair.nativeExports.protected[method]).toBe(8);
            for (const [index, reference] of outputs[0].entries()) {
                expectPixels(await exportBytes(outputs[1][index]), await exportBytes(reference));
                const nativeDecoded = await decode(reference, pair.native, pair.nativeIntrinsics);
                const decoded = await decode(outputs[1][index], pair.protected, pair.protectedIntrinsics);
                expect([decoded.width, decoded.height]).toEqual([nativeDecoded.width, nativeDecoded.height]);
                expectPixels(decoded.data, nativeDecoded.data);
            }
        });
    });

    test.for(methods.flatMap((method) => [
        { owner: '2d', effect: 'initialize' },
        { owner: 'webgl', effect: 'initialize' },
        { owner: 'webgl2', effect: 'initialize' },
        { owner: 'bitmaprenderer', effect: 'initialize' },
        { owner: 'webgl', effect: 'resize' },
        { owner: 'webgl', effect: 'reentrant' },
    ].map((configuration) => ({ method, ...configuration }))))(
        'selects export ownership after actual type effects: $method $owner $effect',
        async ({ method, owner, effect }) => {
            await withCanvasRealmPair(async (pair) => {
                const outputs: (string | Blob | null)[] = [];
                const nested: string[] = [];
                const snapshots: ImageData[] = [];
                const logs: string[][] = [[], []];
                const queues: number[][] = [];
                const states: number[][] = [];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = 64;
                    canvas.height = 1;
                    const copy = realm.document.createElement('canvas');
                    const copyContext = copy.getContext('2d')!;
                    const read = (): ImageData => {
                        copy.width = canvas.width;
                        copy.height = canvas.height;
                        Reflect.apply(native.drawImage, copyContext, [canvas, 0, 0]);
                        return Reflect.apply(native.getImageData, copyContext, [0, 0, copy.width, copy.height]);
                    };
                    let context: CanvasRenderingContext2D | ImageBitmapRenderingContext
                    | WebGLRenderingContext | WebGL2RenderingContext | null = null;
                    let gl: WebGLRenderingContext | WebGL2RenderingContext | undefined;
                    const source = realm.document.createElement('canvas');
                    source.width = 64;
                    source.height = 1;
                    const sourceContext = source.getContext('2d')!;
                    sourceContext.fillStyle = '#234567';
                    sourceContext.fillRect(0, 0, 64, 1);
                    const bitmap = await realm.createImageBitmap(source);
                    const draw = (): void => {
                        if (gl) {
                            gl.clearColor(0.25, 0.5, 0.75, 1);
                            gl.clear(gl.COLOR_BUFFER_BIT);
                        } else if (owner === '2d') {
                            const twoD = context as CanvasRenderingContext2D;
                            twoD.fillStyle = '#234567';
                            twoD.fillRect(0, 0, canvas.width, canvas.height);
                        } else {
                            (context as ImageBitmapRenderingContext).transferFromImageBitmap(bitmap);
                        }
                    };
                    if (effect !== 'initialize') {
                        gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
                        context = gl;
                        gl.clearColor(0.75, 0.25, 0.5, 1);
                        gl.clear(gl.COLOR_BUFFER_BIT);
                    }
                    let events = 0;
                    canvas.addEventListener('webglcontextcreationerror', () => { events += 1; });
                    const type = {
                        [Symbol.toPrimitive](hint: string): string {
                            logs[index].push(`type:${hint}:${this === type}`);
                            if (effect === 'initialize') {
                                context = canvas.getContext(owner, { preserveDrawingBuffer: true }) as typeof context;
                                expect(context).not.toBeNull();
                                if (owner === 'webgl' || owner === 'webgl2') {
                                    gl = context as WebGLRenderingContext | WebGL2RenderingContext;
                                }
                            } else if (effect === 'resize') {
                                canvas.width = 41;
                                canvas.height = 3;
                            } else {
                                nested.push(canvas.toDataURL());
                            }
                            draw();
                            snapshots.push(read());
                            if (gl) {
                                gl.enable(0xbad);
                            }
                            return 'image/png';
                        },
                    };
                    const quality = {
                        [Symbol.toPrimitive](): never { throw new Error('Unexpected quality conversion'); },
                        valueOf(): never { throw new Error('Unexpected quality conversion'); },
                    };
                    let callbacks = 0;
                    let queue: number[] = [];
                    if (method === 'toDataURL') {
                        outputs.push(Reflect.apply(canvas.toDataURL, canvas, [type, quality]));
                        if (gl) {
                            queue = [gl.getError(), gl.getError()];
                        }
                        expectPixels(read().data, snapshots[index].data);
                    } else {
                        outputs.push(await new Promise<Blob | null>((resolve) => {
                            const callback = new realm.Proxy((blob: Blob | null): void => {
                                callbacks += 1;
                                logs[index].push('callback');
                                resolve(blob);
                            }, {});
                            expect(Reflect.apply(canvas.toBlob, canvas, [callback, type, quality])).toBeUndefined();
                            expect(pair.nativeBlobCallbacks[index === 0 ? 'native' : 'protected'][0]).toBe(callback);
                            if (gl) {
                                queue = [gl.getError(), gl.getError()];
                            }
                            expectPixels(read().data, snapshots[index].data);
                            if (gl) {
                                gl.clearColor(1, 1, 1, 1);
                                gl.clear(gl.COLOR_BUFFER_BIT);
                            } else if (owner === '2d') {
                                const twoD = context as CanvasRenderingContext2D;
                                twoD.fillStyle = '#ffffff';
                                twoD.fillRect(0, 0, canvas.width, canvas.height);
                            }
                            logs[index].push('return');
                            queueMicrotask(() => logs[index].push('microtask'));
                        }));
                    }
                    queues.push(queue);
                    states.push([canvas.width, canvas.height]);
                    expect(callbacks).toBe(method === 'toBlob' ? 1 : 0);
                    expect(events).toBe(0);
                    expect(Reflect.apply(native.getContext, canvas, [owner])).toBe(context);
                    const thrownValue = new realm.URIError('Original owner conversion failure');
                    const invalid = { toString(): never { throw thrownValue; } };
                    expect(thrown(() => Reflect.apply(canvas[method], canvas, method === 'toBlob'
                        ? [(): void => { throw new Error('Unexpected failure callback'); }, invalid] : [invalid])))
                        .toBe(thrownValue);
                    bitmap.close();
                }
                expect(logs[1]).toEqual(logs[0]);
                expect(logs[0]).toEqual(method === 'toDataURL' ? ['type:string:true']
                    : ['type:string:true', 'return', 'microtask', 'callback']);
                expect(states[1]).toEqual(states[0]);
                expect(queues[1]).toEqual(queues[0]);
                expectPixels(snapshots[1].data, snapshots[0].data);
                expect(pair.nativeExports.protected).toEqual(pair.nativeExports.native);
                expect(pair.nativeExports.protected[method]).toBe(2 + Number(effect === 'reentrant'
                    && method === 'toDataURL'));
                const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
                const actual = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                expect([actual.width, actual.height]).toEqual([reference.width, reference.height]);
                expectPixels(reference.data, snapshots[0].data);
                expectPixels(actual.data, owner === '2d'
                    ? referenceSourceNoise(snapshots[0], pair.seed) : reference.data);
                if (effect === 'reentrant') {
                    expectPixels(await exportBytes(nested[1]), await exportBytes(nested[0]));
                }
            });
        },
    );

    test.for(methods)('keeps ordinary non 2D WebGPU exports original native where available for %s', async (method, {
        annotate,
    }) => {
        await withCanvasRealmPair(async (pair) => {
            const availability: string[] = [];
            const outputs: (string | Blob | null)[] = [];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const { gpu } = (realm.navigator as Navigator & { readonly gpu?: FixtureGpu });
                if (!gpu) {
                    availability.push('missing-api');
                    continue;
                }
                const adapter = await gpu.requestAdapter();
                if (!adapter) {
                    availability.push('no-adapter');
                    continue;
                }
                const device = await adapter.requestDevice();
                try {
                    const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                    (realm.frameElement as HTMLIFrameElement).hidden = false;
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = 32;
                    canvas.height = 24;
                    realm.document.body.appendChild(canvas);
                    const context = canvas.getContext('webgpu') as unknown as FixtureGpuContext | null;
                    expect(context).not.toBeNull();
                    const format = gpu.getPreferredCanvasFormat();
                    context!.configure({
                        device, format, usage: 18, alphaMode: 'premultiplied',
                    });
                    const encoder = device.createCommandEncoder();
                    const pass = encoder.beginRenderPass({
                        colorAttachments: [{
                            view: context!.getCurrentTexture().createView(),
                            clearValue: {
                                r: 35 / 255, g: 69 / 255, b: 103 / 255, a: 1,
                            },
                            loadOp: 'clear',
                            storeOp: 'store',
                        }],
                    });
                    pass.end();
                    device.queue.submit([encoder.finish()]);
                    await device.queue.onSubmittedWorkDone();
                    const copy = realm.document.createElement('canvas');
                    copy.width = 32;
                    copy.height = 24;
                    const copyContext = copy.getContext('2d')!;
                    Reflect.apply(native.drawImage, copyContext, [canvas, 0, 0]);
                    const before = Reflect.apply(native.getImageData, copyContext, [0, 0, 32, 24]) as ImageData;
                    expect(Array.from(before.data).every((value, offset) => offset % 4 !== 3 || value === 255))
                        .toBe(true);
                    availability.push('opaque-native-owner');
                    let events = 0;
                    canvas.addEventListener('webglcontextcreationerror', () => { events += 1; });
                    outputs.push(await encode(canvas, method));
                    expect(events).toBe(0);
                    expect(Reflect.apply(native.getContext, canvas, ['webgpu'])).toBe(context);
                    expect(Reflect.apply(native.getContext, canvas, ['2d'])).toBeNull();
                    expect([canvas.width, canvas.height]).toEqual([32, 24]);
                    copyContext.clearRect(0, 0, 32, 24);
                    Reflect.apply(native.drawImage, copyContext, [canvas, 0, 0]);
                    expectPixels(Reflect.apply(native.getImageData, copyContext, [0, 0, 32, 24]).data, before.data);
                } finally {
                    device.destroy();
                }
            }
            expect(availability[1]).toBe(availability[0]);
            await annotate(JSON.stringify({ method, availability }), 'ordinary-native-webgpu-availability');
            if (availability[0] !== 'opaque-native-owner') {
                expect(pair.nativeExports.protected[method]).toBe(0);
                expect(pair.nativeExports.native[method]).toBe(0);
                return;
            }
            expect(pair.nativeExports.protected[method]).toBe(1);
            expect(pair.nativeExports.native[method]).toBe(1);
            expectPixels(await exportBytes(outputs[1]), await exportBytes(outputs[0]));
            const actual = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
            const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
            expect([actual.width, actual.height]).toEqual([reference.width, reference.height]);
            expectPixels(actual.data, reference.data);
        });
    });

    test('validates the independent source-noise reference against standard vectors', () => {
        const key = Uint8Array.from({ length: 16 }, (_, index) => index);
        const vectors = [
            [0, '310e0edd47db6f72'], [1, 'fd67dc93c539f874'],
            [15, 'e545be4961ca29a1'], [16, 'db9bc2577fcc2a3f'], [63, '724506eb4c328a95'],
        ] as const;
        vectors.forEach(([length, expected]) => {
            const input = Uint8Array.from({ length }, (_, index) => index);
            const digest = referenceSipHash(key, input);
            const bytes = Array.from({ length: 8 }, (_, index) => Number((digest >> BigInt(index * 8)) & 255n));
            expect(bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')).toBe(expected);
        });
    });

    test.for(methods.flatMap((method) => ['x', 'y'].flatMap((axis) => (
        ['inside', 'outside'].map((final) => ({ method, axis, final }))
    ))))('chooses original size coverage after one type conversion: $method $axis $final', async ({
        method, axis, final,
    }) => {
        await withCanvasRealmPair(async (pair) => {
            const outputs: (string | Blob | null)[] = [];
            const contexts: CanvasRenderingContext2D[] = [];
            const logs: string[][] = [[], []];
            const sizeGets = { count: 0 };
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = axis === 'x' && final === 'inside' ? 32768 : 1;
                canvas.height = axis === 'y' && final === 'inside' ? 32768 : 1;
                const context = canvas.getContext('2d')!;
                contexts.push(context);
                Object.defineProperties(canvas, {
                    width: { get: (): number => { sizeGets.count += 1; return 1; } },
                    height: { get: (): number => { sizeGets.count += 1; return 1; } },
                });
                const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                const type = Object.freeze({
                    toString(): string {
                        logs[index].push(`type:${this === type}`);
                        const length = final === 'inside' ? 32767 : 32768;
                        Reflect.apply(native[axis === 'x' ? 'setCanvasWidth' : 'setCanvasHeight'], canvas, [length]);
                        context.fillStyle = '#234567';
                        context.fillRect(0, 0, axis === 'x' ? length : 1, axis === 'y' ? length : 1);
                        try {
                            const crop = context.getImageData(0, 0, axis === 'x' ? 256 : 1, axis === 'y' ? 256 : 1);
                            logs[index].push(`nested:${crop.width}:${crop.height}`);
                        } catch (error) {
                            logs[index].push(`nested:${(error as Error).name}`);
                        }
                        return 'image/png';
                    },
                });
                outputs.push(await encode(canvas, method, [type]));
            }
            expect(pair.nativeExports.protected[method]).toBe(1);
            expect(sizeGets.count).toBe(0);
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0][0]).toBe('type:true');
            if (final === 'outside') {
                if (outputs[0] === null || outputs[0] === 'data:,') {
                    expect(outputs[1]).toBe(outputs[0]);
                } else {
                    expect(await exportBytes(outputs[1])).toEqual(await exportBytes(outputs[0]));
                }
            } else {
                const expected = contexts[1].getImageData(0, 0, axis === 'x' ? 32767 : 1, axis === 'y' ? 32767 : 1);
                const result = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                expectPixels(result.data, expected.data);
            }
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

    test.for(methods.flatMap((method) => ['x', 'y'].flatMap((axis) => (
        ['webgl', 'transferred'].flatMap((owner) => (
            ['image/png', 'image/jpeg', 'image/webp', 'invalid/type'].map((mime) => ({
                method, axis, owner, mime,
            }))
        ))
    ))))('keeps oversized $owner $axis $mime exports native for $method', async ({
        method, axis, owner, mime,
    }, { annotate }) => {
        await withCanvasRealmPair(async (pair) => {
            const outputs: (string | Blob | null)[] = [];
            const errors: unknown[] = [];
            const callbacks = [0, 0];
            const dimensions: number[][] = [];
            const publicationFailures: (string | undefined)[] = [];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = axis === 'x' ? 32768 : 1;
                canvas.height = axis === 'y' ? 32768 : 1;
                let gl: WebGLRenderingContext | undefined;
                let context: OffscreenCanvasRenderingContext2D | undefined;
                let before: ArrayLike<number> | undefined;
                let ownerReadError: Error | undefined;
                if (owner === 'webgl') {
                    gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
                    gl.clearColor(0.25, 0.5, 0.75, 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    dimensions.push([canvas.width, canvas.height, gl.drawingBufferWidth, gl.drawingBufferHeight]);
                    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(
                        0,
                        0,
                        gl.drawingBufferWidth,
                        gl.drawingBufferHeight,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        pixels,
                    );
                    before = pixels;
                } else {
                    (realm.frameElement as HTMLIFrameElement).hidden = false;
                    canvas.style.width = '1px';
                    canvas.style.height = '1px';
                    realm.document.body.appendChild(canvas);
                    context = canvas.transferControlToOffscreen().getContext('2d')!;
                    context.fillStyle = '#234567';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    dimensions.push([canvas.width, canvas.height]);
                    await new Promise<void>((resolve) => realm.requestAnimationFrame(() => {
                        realm.requestAnimationFrame(() => resolve());
                    }));
                    try {
                        before = context.getImageData(0, 0, 1, 1).data;
                    } catch (error) {
                        ownerReadError = error as Error;
                    }
                    const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                    const committed = realm.document.createElement('canvas');
                    committed.width = canvas.width;
                    committed.height = canvas.height;
                    const committedContext = committed.getContext('2d')!;
                    let ready = false;
                    for (let frame = 0; frame < 8; frame += 1) {
                        try {
                            Reflect.apply(native.drawImage, committedContext, [canvas, 0, 0]);
                            const image = Reflect.apply(native.getImageData, committedContext, [
                                0, 0, canvas.width, canvas.height,
                            ]);
                            const pixel = [35, 69, 103, 255];
                            ready = Array.from(image.data).every((value, offset) => value === pixel[offset % 4]);
                        } catch (error) {
                            publicationFailures[index] = (error as Error).name;
                            break;
                        }
                        if (ready) {
                            break;
                        }
                        await new Promise<void>((resolve) => { realm.requestAnimationFrame(() => resolve()); });
                    }
                    expect(ready || publicationFailures[index] !== undefined).toBe(true);
                }
                const callback = (result: Blob | null): void => { callbacks[index] += 1; outputs[index] = result; };
                try {
                    if (method === 'toDataURL') {
                        outputs[index] = canvas.toDataURL(mime, 0.5);
                    } else {
                        await new Promise<void>((resolve) => {
                            canvas.toBlob((result) => { callback(result); resolve(); }, mime, 0.5);
                        });
                    }
                    errors[index] = undefined;
                } catch (error) {
                    outputs[index] = null;
                    errors[index] = error;
                }
                expect([canvas.width, canvas.height]).toEqual([axis === 'x' ? 32768 : 1, axis === 'y' ? 32768 : 1]);
                if (gl) {
                    const after = new Uint8Array(before!.length);
                    gl.readPixels(
                        0,
                        0,
                        gl.drawingBufferWidth,
                        gl.drawingBufferHeight,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        after,
                    );
                    expectPixels(after, before!);
                    expect(canvas.getContext('webgl')).toBe(gl);
                    expect(gl.isContextLost()).toBe(false);
                } else {
                    expect(() => canvas.getContext('2d')).toThrow();
                    if (before) {
                        expectPixels(context!.getImageData(0, 0, 1, 1).data, before);
                    } else {
                        const error = thrown(() => context!.getImageData(0, 0, 1, 1)) as Error;
                        expect(error.name).toBe(ownerReadError!.name);
                        expect(error.message).toBe(ownerReadError!.message);
                        expect(Object.getPrototypeOf(error)).toBe(Object.getPrototypeOf(ownerReadError));
                    }
                }
            }
            expect(dimensions[1]).toEqual(dimensions[0]);
            expect(publicationFailures[1]).toBe(publicationFailures[0]);
            expect(pair.nativeExports.native[method]).toBe(1);
            expect(pair.nativeExports.protected[method]).toBe(1);
            expect(callbacks[1]).toBe(callbacks[0]);
            expect(callbacks[0]).toBe(method === 'toBlob' && errors[0] === undefined ? 1 : 0);
            if (errors[0] !== undefined) {
                expectError(errors[0], errors[1], pair);
            } else {
                expect(errors[1]).toBeUndefined();
                if (outputs[0] === null || outputs[0] === 'data:,') {
                    expect(outputs[1]).toBe(outputs[0]);
                } else {
                    expect(await exportBytes(outputs[1])).toEqual(await exportBytes(outputs[0]));
                    const decoded = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
                    await annotate(JSON.stringify({
                        method, owner, mime, dimensions, decoded: [decoded.width, decoded.height], callbacks,
                    }), 'oversized-native-serialization');
                }
            }
        });
    });

    test.each(methods)('preserves transparent native profiles after type effects for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const settings of [
                { colorSpace: 'display-p3', colorType: 'unorm8' },
                { colorSpace: 'srgb', colorType: 'float16' },
            ] as const) {
                for (const alpha of [0, 0.0001, 0.5]) {
                    for (const mime of ['image/png', 'image/jpeg', 'image/webp']) {
                        const results: (string | Blob | null)[] = [];
                        for (const realm of [pair.native, pair.protected]) {
                            const canvas = realm.document.createElement('canvas');
                            canvas.width = 32;
                            canvas.height = 24;
                            const context = canvas.getContext('2d', settings) as CanvasRenderingContext2D;
                            context.fillStyle = '#234567';
                            context.fillRect(0, 0, 32, 24);
                            let conversions = 0;
                            const type = {
                                toString(): string {
                                    conversions += 1;
                                    context.clearRect(0, 0, 32, 24);
                                    context.fillStyle = `rgba(35, 69, 103, ${alpha})`;
                                    context.fillRect(0, 0, 32, 24);
                                    return mime;
                                },
                            };
                            results.push(await encode(canvas, method, [type]));
                            expect(conversions).toBe(1);
                            expect(canvas.getContext('2d')).toBe(context);
                        }
                        expect(await exportBytes(results[1])).toEqual(await exportBytes(results[0]));
                    }
                }
            }
        });
    });

    test.each(methods)('keeps unowned transparent boundary canvases native for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const [width, height] of [[32767, 1], [1, 32767]]) {
                const results: (string | Blob | null)[] = [];
                for (const realm of [pair.native, pair.protected]) {
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    results.push(await encode(canvas, method));
                    expect(canvas.getContext('webgl')).not.toBeNull();
                }
                expect(await exportBytes(results[1])).toEqual(await exportBytes(results[0]));
            }
        });
    });

    test.each(methods.flatMap((method) => ['default', 'p3', 'float16'].flatMap((mode) => (
        [[32768, 1], [1, 32768]].map(([width, height]) => ({
            method, mode, width, height,
        }))
    ))))('preserves opaque boundary exports $method $mode $width×$height', async ({
        method, mode, width, height,
    }) => {
        await withCanvasRealmPair(async (pair) => {
            const outputs: (string | Blob | null)[] = [];
            const errors: unknown[] = [];
            const contexts: CanvasRenderingContext2D[] = [];
            for (const realm of [pair.native, pair.protected]) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const settings = mode === 'float16' ? { colorType: 'float16' } : {};
                if (mode === 'p3') {
                    Object.assign(settings, { colorSpace: 'display-p3' });
                }
                const context = canvas.getContext('2d', settings as CanvasRenderingContext2DSettings)!;
                contexts.push(context);
                context.fillStyle = '#234567';
                context.fillRect(0, 0, width, height);
                try {
                    outputs.push(await encode(canvas, method));
                    errors.push(undefined);
                } catch (error) {
                    outputs.push(null);
                    errors.push(error);
                }
                expect(canvas.getContext('2d')).toBe(context);
                expect([canvas.width, canvas.height]).toEqual([width, height]);
            }
            expect(errors[0]).toBeUndefined();
            expect(errors[1]).toBeUndefined();
            expect(pair.nativeExports.protected[method]).toBe(1);
            if (outputs[0] === null || outputs[0] === 'data:,') {
                expect(outputs[1]).toBe(outputs[0]);
            } else {
                const attributes = contexts[0].getContextAttributes() as
                    CanvasRenderingContext2DSettings & { colorType?: string };
                if (attributes.colorSpace !== 'srgb'
                    || (attributes.colorType !== undefined && attributes.colorType !== 'unorm8')) {
                    expect(await exportBytes(outputs[1])).toEqual(await exportBytes(outputs[0]));
                } else {
                    const expected = contexts[1].getImageData(0, 0, width, height);
                    const actual = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                    expect([actual.width, actual.height]).toEqual([width, height]);
                    expectPixels(actual.data, expected.data);
                }
            }
        });
    });

    test.each(methods)('matches native clamped WebGL representation and errors for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const [width, height] of [[32767, 1], [1, 32767]]) {
                const outputs: (string | Blob | null)[] = [];
                const errors: unknown[] = [];
                const metadata: number[][] = [];
                for (const realm of [pair.native, pair.protected]) {
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
                    const bufferWidth = gl.drawingBufferWidth;
                    const bufferHeight = gl.drawingBufferHeight;
                    gl.clearColor(0.25, 0.5, 0.75, 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.enable(gl.SCISSOR_TEST);
                    gl.scissor(
                        width > 1 ? Math.floor(bufferWidth / 2) : 0,
                        height > 1 ? Math.floor(bufferHeight / 2) : 0,
                        width > 1 ? Math.ceil(bufferWidth / 2) : 1,
                        height > 1 ? Math.ceil(bufferHeight / 2) : 1,
                    );
                    gl.clearColor(0.75, 0.25, 0.5, 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    const before = new Uint8Array(bufferWidth * bufferHeight * 4);
                    gl.readPixels(0, 0, bufferWidth, bufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, before);
                    const frame = new realm.VideoFrame(canvas, { timestamp: 0 });
                    metadata.push([frame.codedWidth, frame.codedHeight, frame.displayWidth, frame.displayHeight]);
                    frame.close();
                    try {
                        outputs.push(await encode(canvas, method));
                        errors.push(undefined);
                    } catch (error) {
                        outputs.push(null);
                        errors.push(error);
                    }
                    const after = new Uint8Array(before.length);
                    gl.readPixels(0, 0, bufferWidth, bufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, after);
                    expectPixels(after, before);
                    expect([canvas.width, canvas.height]).toEqual([width, height]);
                    expect([gl.drawingBufferWidth, gl.drawingBufferHeight]).toEqual([bufferWidth, bufferHeight]);
                    expect(canvas.getContext('webgl')).toBe(gl);
                    expect(canvas.getContext('2d')).toBeNull();
                    expect(Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE))).toEqual([0.75, 0.25, 0.5, 1]);
                    expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);
                }
                expect(metadata[1]).toEqual(metadata[0]);
                expect(pair.nativeExports.protected[method]).toBe(pair.nativeExports.native[method]);
                if (errors[0] !== undefined) {
                    expectError(errors[0], errors[1], pair);
                } else {
                    expect(errors[1]).toBeUndefined();
                    const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
                    const result = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                    expect([reference.width, reference.height]).toEqual(metadata[0].slice(2));
                    expect([result.width, result.height]).toEqual([reference.width, reference.height]);
                    expectPixels(result.data, reference.data);
                }
            }
        });
    });

    test.for(methods.flatMap((method) => ['x', 'y'].flatMap((axis) => (
        [64, 32767].map((length) => ({ method, axis, length }))
    ))))(
        'keeps decoded native mixed-alpha WebGL with premultipliedAlpha=false: $method $axis $length',
        async ({ method, axis, length }, { annotate }) => {
            await withCanvasRealmPair(async (pair) => {
                const outputs: (string | Blob | null)[] = [];
                const errors: unknown[] = [];
                const callbacks = [0, 0];
                const metadata: unknown[] = [];
                const queues: number[][] = [];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = axis === 'x' ? length : 1;
                    canvas.height = axis === 'y' ? length : 1;
                    const gl = canvas.getContext('webgl', {
                        preserveDrawingBuffer: true,
                        premultipliedAlpha: false,
                    })!;
                    const width = gl.drawingBufferWidth;
                    const height = gl.drawingBufferHeight;
                    gl.clearColor(0.25, 0.5, 0.75, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.enable(gl.SCISSOR_TEST);
                    gl.scissor(
                        axis === 'x' ? Math.floor(width / 3) : 0,
                        axis === 'y' ? Math.floor(height / 3) : 0,
                        axis === 'x' ? Math.ceil((width * 2) / 3) : 1,
                        axis === 'y' ? Math.ceil((height * 2) / 3) : 1,
                    );
                    gl.clearColor(0.13, 0.27, 0.41, 0.5);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.scissor(
                        axis === 'x' ? Math.floor((width * 2) / 3) : 0,
                        axis === 'y' ? Math.floor((height * 2) / 3) : 0,
                        axis === 'x' ? Math.ceil(width / 3) : 1,
                        axis === 'y' ? Math.ceil(height / 3) : 1,
                    );
                    gl.clearColor(0.75, 0.25, 0.5, 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    const before = new Uint8Array(width * height * 4);
                    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, before);
                    const frame = new realm.VideoFrame(canvas, { timestamp: 0 });
                    metadata.push({
                        html: [canvas.width, canvas.height],
                        buffer: [width, height],
                        frame: [frame.codedWidth, frame.codedHeight, frame.displayWidth, frame.displayHeight],
                        attributes: gl.getContextAttributes(),
                    });
                    frame.close();
                    const queue: number[] = [];
                    let completion: Promise<void> | undefined;
                    try {
                        if (method === 'toDataURL') {
                            outputs[index] = canvas.toDataURL();
                        } else {
                            let complete: () => void;
                            completion = new Promise<void>((resolve) => {
                                complete = resolve;
                            });
                            canvas.toBlob((result) => {
                                callbacks[index] += 1;
                                outputs[index] = result;
                                complete();
                            });
                        }
                        errors[index] = undefined;
                    } catch (error) {
                        completion = undefined;
                        outputs[index] = null;
                        errors[index] = error;
                    }
                    for (let count = 0; count < 8; count += 1) {
                        const error = gl.getError();
                        if (error === gl.NO_ERROR) {
                            break;
                        }
                        queue.push(error);
                    }
                    queues.push(queue);
                    if (completion) {
                        await completion;
                    }
                    const after = new Uint8Array(before.length);
                    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, after);
                    expectPixels(after, before);
                    expect(gl.getContextAttributes()!.premultipliedAlpha).toBe(false);
                    expect(canvas.getContext('webgl')).toBe(gl);
                    expect(gl.isContextLost()).toBe(false);
                    expect(Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE))).toEqual([0.75, 0.25, 0.5, 1]);
                }
                expect(metadata[1]).toEqual(metadata[0]);
                expect(queues[1]).toEqual(queues[0]);
                expect(pair.nativeExports.protected[method]).toBe(pair.nativeExports.native[method]);
                expect(pair.nativeExports.protected[method]).toBe(1);
                expect(callbacks[1]).toBe(callbacks[0]);
                if (errors[0] !== undefined) {
                    expectError(errors[0], errors[1], pair);
                } else {
                    expect(errors[1]).toBeUndefined();
                    const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
                    const result = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                    await annotate(JSON.stringify({
                        method,
                        axis,
                        length,
                        metadata,
                        callbacks,
                        queues,
                        nativeDimensions: [reference.width, reference.height],
                        protectedDimensions: [result.width, result.height],
                    }), 'mixed-alpha-webgl-dimensions');
                    expect([result.width, result.height]).toEqual([reference.width, reference.height]);
                    const expectedData = reference.data;
                    await annotate(JSON.stringify({
                        method,
                        axis,
                        length,
                        metadata,
                        callbacks,
                        queues,
                        differences: Array.from(result.data).reduce((count, value, offset) => (
                            count + Number(value !== expectedData[offset])
                        ), 0),
                        alphaDifferences: Array.from(result.data).reduce((count, value, offset) => (
                            count + Number(offset % 4 === 3 && value !== reference.data[offset])
                        ), 0),
                    }), 'mixed-alpha-webgl-differential');
                    expectPixels(result.data, expectedData);
                }
            });
        },
    );

    test.for(methods.flatMap((method) => (['webgl', 'webgl2'] as const).flatMap((owner) => (
        [
            { alpha: 'opaque', length: 32767, premultipliedAlpha: true },
            { alpha: 'mixed', length: 32767, premultipliedAlpha: true },
            { alpha: 'straight', length: 64, premultipliedAlpha: false },
        ].map((configuration) => ({ method, owner, ...configuration }))
    ))))('retains protected transferred owners after owner scope changes: $method $owner $alpha', async ({
        method, owner, alpha, length, premultipliedAlpha,
    }, { annotate }) => {
        await withCanvasRealmPair(async (pair) => {
            const outputs: (string | Blob | null)[] = [];
            const sources: ImageData[] = [];
            const metadata: number[][] = [];
            const queues: number[][] = [];
            const logs: string[][] = [[], []];
            let referenceRaster: TransferredReferenceRaster | undefined;
            const fixtures: {
                realm: Realm;
                canvas: HTMLCanvasElement;
                offscreen: OffscreenCanvas;
                gl: WebGLRenderingContext | WebGL2RenderingContext;
                width: number;
                height: number;
                before: Uint8Array;
                dimensions: number[];
                events: { count: number };
            }[] = [];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                (realm.frameElement as HTMLIFrameElement).hidden = false;
                const canvas = realm.document.createElement('canvas');
                canvas.width = 1;
                canvas.height = length;
                canvas.style.height = '1px';
                realm.document.body.appendChild(canvas);
                const offscreen = canvas.transferControlToOffscreen();
                const gl = offscreen.getContext(owner, { preserveDrawingBuffer: true, premultipliedAlpha }) as
                    WebGLRenderingContext | WebGL2RenderingContext;
                expect(gl).not.toBeNull();
                const width = gl.drawingBufferWidth;
                const height = gl.drawingBufferHeight;
                gl.clearColor(
                    alpha === 'straight' ? 1 / 255 : 0.25,
                    alpha === 'straight' ? 1 / 255 : 0.5,
                    alpha === 'straight' ? 1 / 255 : 0.75,
                    alpha === 'opaque' ? 1 : 0.5,
                );
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(0, Math.floor(height / 2), 1, Math.ceil(height / 2));
                gl.clearColor(0.75, 0.25, 0.5, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                const before = new Uint8Array(width * height * 4);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, before);
                const readinessCopy = realm.document.createElement('canvas');
                const readinessContext = Reflect.apply(native.getContext, readinessCopy, ['2d']) as
                    CanvasRenderingContext2D;
                let previous: Uint8ClampedArray | undefined;
                let ready = false;
                for (let attempt = 0; attempt < 8; attempt += 1) {
                    await new Promise<void>((resolve) => realm.requestAnimationFrame(() => {
                        realm.requestAnimationFrame(() => resolve());
                    }));
                    readinessCopy.width = canvas.width;
                    readinessCopy.height = canvas.height;
                    Reflect.apply(native.drawImage, readinessContext, [canvas, 0, 0]);
                    const pixels = Reflect.apply(native.getImageData, readinessContext, [
                        0, 0, canvas.width, canvas.height,
                    ]) as ImageData;
                    const hasOpaque = Array.from(pixels.data).some((value, offset) => (
                        offset % 4 === 3 && value === 255
                    ));
                    const prior = previous;
                    if (hasOpaque && prior && prior.length === pixels.data.length
                        && pixels.data.every((value, offset) => value === prior[offset])) {
                        ready = true;
                        break;
                    }
                    previous = new realm.Uint8ClampedArray(pixels.data);
                }
                expect(ready).toBe(true);
                const dimensions = [canvas.width, canvas.height, offscreen.width, offscreen.height];
                const events = { count: 0 };
                canvas.addEventListener('webglcontextcreationerror', () => { events.count += 1; });
                fixtures.push({
                    realm, canvas, offscreen, gl, width, height, before, dimensions, events,
                });
            }
            for (const [index, fixture] of fixtures.entries()) {
                const {
                    realm, canvas, width, height,
                } = fixture;
                const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                const frame = new realm.VideoFrame(canvas, { timestamp: 0 });
                try {
                    metadata.push([canvas.width, canvas.height, width, height,
                        frame.displayWidth, frame.displayHeight]);
                    if (native.exportPlatform === 'firefox') {
                        const copy = new realm.OffscreenCanvas(frame.displayWidth, frame.displayHeight);
                        const context = Reflect.apply(native.offscreenGetContext, copy, ['2d']) as
                            OffscreenCanvasRenderingContext2D;
                        Reflect.apply(native.offscreenDrawImage, context, [frame, 0, 0]);
                        sources.push(Reflect.apply(native.offscreenGetImageData, context, [
                            0, 0, frame.displayWidth, frame.displayHeight,
                        ]));
                        if (index === 0) {
                            const referenceCanvas = realm.document.createElement('canvas');
                            referenceCanvas.width = frame.displayWidth;
                            referenceCanvas.height = frame.displayHeight;
                            const referenceOwner = Reflect.apply(
                                native.transferControlToOffscreen,
                                referenceCanvas,
                                [],
                            ) as OffscreenCanvas;
                            const referenceContext = Reflect.apply(
                                native.offscreenGetContext,
                                referenceOwner,
                                ['2d'],
                            ) as OffscreenCanvasRenderingContext2D;
                            Reflect.apply(native.offscreenDrawImage, referenceContext, [frame, 0, 0]);
                            referenceRaster = { canvas: referenceCanvas, context: referenceContext };
                        }
                    } else {
                        const copy = realm.document.createElement('canvas');
                        copy.width = canvas.width;
                        copy.height = canvas.height;
                        const context = Reflect.apply(native.getContext, copy, ['2d']) as
                            CanvasRenderingContext2D;
                        Reflect.apply(native.drawImage, context, [canvas, 0, 0]);
                        sources.push(Reflect.apply(native.getImageData, context, [
                            0, 0, canvas.width, canvas.height,
                        ]));
                    }
                } finally {
                    frame.close();
                }
            }
            expect(metadata[1]).toEqual(metadata[0]);
            expectPixels(sources[1].data, sources[0].data);
            expect(Array.from(sources[0].data).some((value, index) => index % 4 === 3 && value === 255)).toBe(true);
            const completions: Promise<void>[] = [];
            for (const [index, fixture] of fixtures.entries()) {
                const {
                    realm, canvas, offscreen, gl, width, height, before, dimensions, events,
                } = fixture;
                gl.enable(0xbad);
                let queue: number[];
                if (method === 'toDataURL') {
                    outputs[index] = canvas.toDataURL();
                    queue = [gl.getError(), gl.getError()];
                } else {
                    let observed: number[] = [];
                    completions.push(new Promise<void>((resolve) => {
                        const callback = new realm.Proxy((blob: Blob | null): void => {
                            logs[index].push('callback');
                            outputs[index] = blob;
                            resolve();
                        }, {});
                        expect(canvas.toBlob(callback)).toBeUndefined();
                        expect(pair.nativeBlobCallbacks[index === 0 ? 'native' : 'protected'][0]).toBe(callback);
                        observed = [gl.getError(), gl.getError()];
                        logs[index].push('return');
                        queueMicrotask(() => logs[index].push('microtask'));
                    }));
                    queue = observed;
                }
                queues.push(queue);
                expect(events.count).toBe(0);
                expect(gl.isContextLost()).toBe(false);
                expect(() => canvas.getContext('2d')).toThrow();
                expect(offscreen.getContext(owner)).toBe(gl);
                expect([canvas.width, canvas.height, offscreen.width, offscreen.height]).toEqual(dimensions);
                expect(gl.getContextAttributes()!.premultipliedAlpha).toBe(premultipliedAlpha);
                expect(Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE))).toEqual([0.75, 0.25, 0.5, 1]);
                const after = new Uint8Array(before.length);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, after);
                expectPixels(after, before);
            }
            await Promise.all(completions);
            fixtures.forEach(({ events }) => expect(events.count).toBe(0));
            expect(pair.nativeExports.protected[method]).toBe(1);
            expect(pair.nativeExports.native[method]).toBe(1);
            expect(queues[1]).toEqual(queues[0]);
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual(method === 'toBlob' ? ['return', 'microtask', 'callback'] : []);
            const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
            const actual = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
            const encodedBaseline = await encodeExpectedSource(
                pair,
                sources[0],
                sources[0].data,
                method,
                [],
                referenceRaster,
            );
            const baseline = await decode(encodedBaseline, pair.native, pair.nativeIntrinsics);
            await annotate(JSON.stringify({
                method,
                owner,
                alpha,
                premultipliedAlpha,
                length,
                metadata,
                nativeEncoded: [reference.width, reference.height],
                expectedEncoded: [baseline.width, baseline.height],
                nativeBaselineDifferences: Array.from(baseline.data).reduce((count, value, index) => (
                    count + Number(value !== reference.data[index])
                ), 0),
                nativeBaselineAlphaDifferences: Array.from(baseline.data).reduce((count, value, index) => (
                    count + Number(index % 4 === 3 && value !== reference.data[index])
                ), 0),
                firstDifferences: Array.from(baseline.data).flatMap((value, offset) => (
                    value === reference.data[offset]
                        ? [] : [[offset, reference.data[offset], value, actual.data[offset]]]
                )).slice(0, 12),
                sourceFirst: Array.from(sources[0].data.slice(0, 12)),
                nativeFirst: Array.from(reference.data.slice(0, 12)),
                protectedFirst: Array.from(actual.data.slice(0, 12)),
            }), 'transferred-webgl-source-baseline');
            expect([baseline.width, baseline.height]).toEqual([reference.width, reference.height]);
            expectPixels(baseline.data, reference.data);
            const protectedSource = referenceSourceNoise(sources[0], pair.seed);
            expectSourceNoise(sources[0], protectedSource);
            expect(Array.from(protectedSource).some((value, index) => value !== sources[0].data[index])).toBe(true);
            const encodedExpected = await encodeExpectedSource(
                pair,
                sources[0],
                protectedSource,
                method,
                [],
                referenceRaster,
            );
            const expected = await decode(encodedExpected, pair.native, pair.nativeIntrinsics);
            expect([actual.width, actual.height]).toEqual([expected.width, expected.height]);
            expectPixels(actual.data, expected.data);
        });
    });

    test.for(methods.flatMap((method) => [64, 32767].flatMap((length) => (
        ['x', 'y'].map((axis) => ({ method, length, axis }))
    ))))('maps native transferred source markers before protection: $method $axis $length', async ({
        method, length, axis,
    }, { annotate }) => {
        await withCanvasRealmPair(async (pair) => {
            const realm = pair.native;
            (realm.frameElement as HTMLIFrameElement).hidden = false;
            const width = axis === 'x' ? length : 1;
            const height = axis === 'y' ? length : 1;
            const data = new realm.Uint8ClampedArray(width * height * 4);
            for (let point = 0; point < width * height; point += 1) {
                data[point * 4] = point % 256;
                data[point * 4 + 1] = Math.floor(point / 256);
                data[point * 4 + 2] = 137;
                data[point * 4 + 3] = 255;
            }
            const source = new realm.ImageData(data, width, height);
            const canvas = realm.document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.style.height = '1px';
            realm.document.body.appendChild(canvas);
            const offscreen = canvas.transferControlToOffscreen();
            const context = offscreen.getContext('2d')!;
            context.putImageData(source, 0, 0);
            await waitForPlaceholder(pair, canvas, context, false);
            const result = await encode(canvas, method);
            expect(pair.nativeExports.native[method]).toBe(1);
            expectPixels(context.getImageData(0, 0, width, height).data, source.data);
            expect(() => canvas.getContext('2d')).toThrow();
            const original = await decode(result, realm, pair.nativeIntrinsics);
            const encoded = await encodeExpectedSource(pair, source, source.data, method);
            const expected = await decode(encoded, realm, pair.nativeIntrinsics);
            expect([original.width, original.height]).toEqual([expected.width, expected.height]);
            expectPixels(original.data, expected.data);
            await annotate(JSON.stringify({
                method,
                sourceHTML: [canvas.width, canvas.height],
                sourceBitmap: [width, height],
                encoded: [original.width, original.height],
                mappings: [0, 1, 8, 16, 512].filter((point) => point < width * height).map((point) => ({
                    encodedPoint: point,
                    sourcePoint: original.data[point * 4] + original.data[point * 4 + 1] * 256,
                    alpha: original.data[point * 4 + 3],
                })),
            }), 'native-transferred-source-markers');
        });
    });

    test.for(methods)(
        'protects original transferred coordinates before native PNG serialization for %s',
        async (method, { annotate }) => {
            await withCanvasRealmPair(async (pair) => {
                const outputs: (string | Blob | null)[] = [];
                const sources: ImageData[] = [];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    (realm.frameElement as HTMLIFrameElement).hidden = false;
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 32767;
                    canvas.style.height = '1px';
                    realm.document.body.appendChild(canvas);
                    const offscreen = canvas.transferControlToOffscreen();
                    const context = offscreen.getContext('2d')!;
                    context.fillStyle = '#234567';
                    context.fillRect(0, 0, 1, 16383);
                    context.fillStyle = '#987654';
                    context.fillRect(0, 16383, 1, 16384);
                    await new Promise<void>((resolve) => realm.requestAnimationFrame(() => {
                        realm.requestAnimationFrame(() => resolve());
                    }));
                    const before = context.getImageData(0, 0, 1, 32767);
                    sources.push(before);
                    const native = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                    const committed = realm.document.createElement('canvas');
                    committed.width = 1;
                    committed.height = 32767;
                    const committedContext = committed.getContext('2d')!;
                    let ready = false;
                    let frames = 0;
                    for (; frames < 8; frames += 1) {
                        Reflect.apply(native.drawImage, committedContext, [canvas, 0, 0]);
                        const pixels = Reflect.apply(native.getImageData, committedContext, [0, 0, 1, 32767]);
                        ready = Array.from(pixels.data).every((value, offset) => value === before.data[offset]);
                        if (ready) {
                            break;
                        }
                        await new Promise<void>((resolve) => { realm.requestAnimationFrame(() => resolve()); });
                    }
                    await annotate(JSON.stringify({
                        method, realm: index, ready, frames,
                    }), 'placeholder-readiness');
                    expect(ready).toBe(true);
                    outputs.push(await encode(canvas, method));
                    expectPixels(context.getImageData(0, 0, 1, 32767).data, before.data);
                    expect(() => canvas.getContext('2d')).toThrow();
                    expect([canvas.width, canvas.height]).toEqual([1, 32767]);
                }
                expect(pair.nativeExports.protected[method]).toBe(1);
                const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
                const result = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                expect([result.width, result.height]).toEqual([reference.width, reference.height]);
                expectPixels(sources[1].data, sources[0].data);
                const baseline = await encodeExpectedSource(pair, sources[0], sources[0].data, method);
                const baselineDecoded = await decode(baseline, pair.native, pair.nativeIntrinsics);
                expect([baselineDecoded.width, baselineDecoded.height]).toEqual([reference.width, reference.height]);
                expectPixels(baselineDecoded.data, reference.data);
                const protectedSource = referenceSourceNoise(sources[0], pair.seed);
                expectSourceNoise(sources[0], protectedSource);
                const encoded = await encodeExpectedSource(pair, sources[0], protectedSource, method);
                const expected = await decode(encoded, pair.native, pair.nativeIntrinsics);
                await annotate(JSON.stringify({
                    method,
                    sourceHTML: [1, 32767],
                    sourceBitmap: [sources[0].width, sources[0].height],
                    encoded: [result.width, result.height],
                    changedSourcePixels: Array.from(protectedSource).reduce((count, value, index) => (
                        count + Number(value !== sources[0].data[index])
                    ), 0),
                }), 'transferred-source-coordinate-noise');
                expect([result.width, result.height]).toEqual([expected.width, expected.height]);
                expectPixels(result.data, expected.data);
            });
        },
    );

    test.for(methods.flatMap((method) => [64, 32767].flatMap((length) => (
        ['x', 'y'].flatMap((axis) => ['committed', 'draw', 'resize', 'transfer'].map((transition) => ({
            method, length, axis, transition,
        })))
    ))))(
        'retains transferred snapshots after type resize and immediate source writes: '
        + '$method $axis $length $transition',
        async ({
            method, length, axis, transition,
        }) => {
            await withCanvasRealmPair(async (pair) => {
                const outputs: (string | Blob | null)[] = [];
                const sourceSnapshots: ImageData[] = [];
                const logs: string[][] = [[], []];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    (realm.frameElement as HTMLIFrameElement).hidden = false;
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = axis === 'x' ? length : 1;
                    canvas.height = axis === 'y' ? length : 1;
                    canvas.style.height = '1px';
                    realm.document.body.appendChild(canvas);
                    let offscreen: OffscreenCanvas | undefined;
                    let context: OffscreenCanvasRenderingContext2D | undefined;
                    let committed: ImageData = new realm.ImageData(canvas.width, canvas.height);
                    const draw = (): void => {
                        context!.clearRect(0, 0, offscreen!.width, offscreen!.height);
                        for (const [band, alpha] of [0, 0.5, 1].entries()) {
                            const start = Math.floor((band * length) / 3);
                            const end = Math.floor(((band + 1) * length) / 3);
                            context!.fillStyle = `rgba(35,69,103,${alpha})`;
                            context!.fillRect(
                                axis === 'x' ? start : 0,
                                axis === 'y' ? start : 0,
                                axis === 'x' ? end - start : 1,
                                axis === 'y' ? end - start : 1,
                            );
                        }
                    };
                    if (transition !== 'transfer') {
                        offscreen = canvas.transferControlToOffscreen();
                        context = offscreen.getContext('2d')!;
                        if (transition === 'committed') {
                            draw();
                        } else if (transition === 'resize') {
                            offscreen.width = 7;
                            offscreen.height = 9;
                        }
                        await new Promise<void>((resolve) => realm.requestAnimationFrame(() => {
                            realm.requestAnimationFrame(() => resolve());
                        }));
                        await waitForPlaceholder(pair, canvas, context, index === 1);
                        committed = context.getImageData(0, 0, offscreen.width, offscreen.height);
                    }
                    const type = {
                        [Symbol.toPrimitive](hint: string): string {
                            logs[index].push(`type:${hint}:${this === type}`);
                            if (transition === 'transfer') {
                                offscreen = canvas.transferControlToOffscreen();
                                context = offscreen.getContext('2d')!;
                            } else if (transition === 'resize') {
                                offscreen!.width = axis === 'x' ? length : 1;
                                offscreen!.height = axis === 'y' ? length : 1;
                            }
                            if (transition !== 'committed') {
                                draw();
                            }
                            return 'image/png';
                        },
                    };
                    const quality = {
                        [Symbol.toPrimitive](): never { throw new Error('Unexpected quality conversion'); },
                    };
                    let snapshot: number[] = [];
                    let state: { fillStyle: string | CanvasGradient | CanvasPattern; transform: number[] } | undefined;
                    let callbacks = 0;
                    const saveSource = (): void => {
                        const current = context!.getImageData(0, 0, offscreen!.width, offscreen!.height);
                        snapshot = Array.from(current.data);
                        sourceSnapshots.push(pair.nativeIntrinsics.exportPlatform === 'chromium'
                        && transition !== 'committed' ? committed : current);
                        state = {
                            fillStyle: context!.fillStyle,
                            transform: Array.from(context!.getTransform().toFloat64Array()),
                        };
                    };
                    // The conversion captures the expected source state before the selected serializer enters.
                    const primitive = type[Symbol.toPrimitive];
                    type[Symbol.toPrimitive] = function observe(hint: string): string {
                        const value = Reflect.apply(primitive, this, [hint]);
                        saveSource();
                        return value;
                    };
                    if (method === 'toDataURL') {
                        outputs.push(Reflect.apply(canvas.toDataURL, canvas, [type, quality]));
                    } else {
                        outputs.push(await new Promise<Blob | null>((resolve) => {
                            const callback = new realm.Proxy((blob: Blob | null): void => {
                                callbacks += 1;
                                logs[index].push('callback');
                                resolve(blob);
                            }, {});
                            const returned = Reflect.apply(canvas.toBlob, canvas, [callback, type, quality]);
                            expect(pair.nativeBlobCallbacks[index === 0 ? 'native' : 'protected'][0]).toBe(callback);
                            expect(returned).toBeUndefined();
                            logs[index].push('return');
                            const current = context!.getImageData(0, 0, offscreen!.width, offscreen!.height);
                            expectPixels(current.data, snapshot);
                            context!.fillStyle = '#ffffff';
                            context!.fillRect(0, 0, offscreen!.width, offscreen!.height);
                            queueMicrotask(() => logs[index].push('microtask'));
                        }));
                    }
                    if (method === 'toDataURL') {
                        expectPixels(context!.getImageData(0, 0, offscreen!.width, offscreen!.height).data, snapshot);
                        expect(context!.fillStyle).toBe(state!.fillStyle);
                    } else {
                        expect(callbacks).toBe(1);
                        expect(context!.fillStyle).toBe('#ffffff');
                    }
                    expect(Array.from(context!.getTransform().toFloat64Array())).toEqual(state!.transform);
                    expect(() => canvas.getContext('2d')).toThrow();
                    expect(offscreen!.getContext('2d')).toBe(context);
                }
                expect(logs[1]).toEqual(logs[0]);
                expect(logs[0]).toEqual(method === 'toBlob'
                    ? ['type:string:true', 'return', 'microtask', 'callback'] : ['type:string:true']);
                expect(pair.nativeExports.native[method]).toBe(1);
                expect(pair.nativeExports.protected[method]).toBe(1);
                const reference = await decode(outputs[0], pair.native, pair.nativeIntrinsics);
                const result = await decode(outputs[1], pair.protected, pair.protectedIntrinsics);
                expect([result.width, result.height]).toEqual([reference.width, reference.height]);
                expect([sourceSnapshots[1].width, sourceSnapshots[1].height])
                    .toEqual([sourceSnapshots[0].width, sourceSnapshots[0].height]);
                expectPixels(sourceSnapshots[1].data, sourceSnapshots[0].data);
                const source = sourceSnapshots[0];
                const baselineEncoded = await encodeExpectedSource(pair, source, source.data, method);
                const baseline = await decode(baselineEncoded, pair.native, pair.nativeIntrinsics);
                expect([baseline.width, baseline.height]).toEqual([reference.width, reference.height]);
                expectPixels(baseline.data, reference.data);
                const protectedSource = referenceSourceNoise(source, pair.seed);
                expectSourceNoise(source, protectedSource);
                const encoded = await encodeExpectedSource(pair, source, protectedSource, method);
                const expected = await decode(encoded, pair.native, pair.nativeIntrinsics);
                expect([result.width, result.height]).toEqual([expected.width, expected.height]);
                expectPixels(result.data, expected.data);
            });
        },
    );

    test.each(methods)('preserves transferred MIME and unchanged quality for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const fixtures = [pair.native, pair.protected].map((realm) => {
                (realm.frameElement as HTMLIFrameElement).hidden = false;
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 24;
                realm.document.body.appendChild(canvas);
                const context = canvas.transferControlToOffscreen().getContext('2d')!;
                for (const [band, alpha] of [0, 0.5, 1].entries()) {
                    context.fillStyle = `rgba(35,69,103,${alpha})`;
                    context.fillRect(band * 10, 0, band === 2 ? 12 : 10, 24);
                }
                return { canvas, context };
            });
            for (const [index, fixture] of fixtures.entries()) {
                await waitForPlaceholder(pair, fixture.canvas, fixture.context, index === 1);
            }
            const sources = fixtures.map(({ context }) => context.getImageData(0, 0, 32, 24));
            expectPixels(sources[1].data, sources[0].data);
            const protectedSource = referenceSourceNoise(sources[0], pair.seed);
            expectSourceNoise(sources[0], protectedSource);
            let hooks = 0;
            const objectQuality = Object.freeze({
                [Symbol.toPrimitive](): never { hooks += 1; throw new Error('Unexpected quality conversion'); },
                valueOf(): never { hooks += 1; throw new Error('Unexpected quality conversion'); },
            });
            for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/unknown']) {
                for (const quality of [0.25, objectQuality]) {
                    const args = [mime, quality];
                    const reference = await encode(fixtures[0].canvas, method, args);
                    const result = await encode(fixtures[1].canvas, method, args);
                    const baseline = await encodeExpectedSource(pair, sources[0], sources[0].data, method, args);
                    expectPixels(await exportBytes(baseline), await exportBytes(reference));
                    const expected = await encodeExpectedSource(pair, sources[0], protectedSource, method, args);
                    expectPixels(await exportBytes(result), await exportBytes(expected));
                    const decoded = await decode(result, pair.protected, pair.protectedIntrinsics);
                    const expectedDecoded = await decode(expected, pair.native, pair.nativeIntrinsics);
                    expect([decoded.width, decoded.height]).toEqual([expectedDecoded.width, expectedDecoded.height]);
                    expectPixels(decoded.data, expectedDecoded.data);
                    if (typeof result === 'string') {
                        expect(result.split(',')[0]).toBe((expected as string).split(',')[0]);
                    } else {
                        expect(result!.type).toBe((expected as Blob).type);
                    }
                }
            }
            expect(hooks).toBe(0);
            expect(pair.nativeExports.native[method]).toBe(8);
            expect(pair.nativeExports.protected[method]).toBe(8);
            fixtures.forEach(({ canvas, context }, index) => {
                expectPixels(context.getImageData(0, 0, 32, 24).data, sources[index].data);
                expect(context.fillStyle).toBe('#234567');
                expect(() => canvas.getContext('2d')).toThrow();
            });
        });
    });

    test.each(methods)('keeps transferred reentrant conversion snapshots independent for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const fixtures = [pair.native, pair.protected].map((realm) => {
                (realm.frameElement as HTMLIFrameElement).hidden = false;
                const canvas = realm.document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 1;
                realm.document.body.appendChild(canvas);
                const context = canvas.transferControlToOffscreen().getContext('2d')!;
                context.fillStyle = '#234567';
                context.fillRect(0, 0, 64, 1);
                return { canvas, context };
            });
            for (const [index, fixture] of fixtures.entries()) {
                await waitForPlaceholder(pair, fixture.canvas, fixture.context, index === 1);
            }
            const committed = fixtures.map(({ context }) => context.getImageData(0, 0, 64, 1));
            const nested: string[] = [];
            const outputs: (string | Blob | null)[] = [];
            const current: ImageData[] = [];
            const logs: string[][] = [[], []];
            for (const [index, { canvas, context }] of fixtures.entries()) {
                const realm = index === 0 ? pair.native : pair.protected;
                const transform = Array.from(context.getTransform().toFloat64Array());
                const type = {
                    toString(): string {
                        logs[index].push(`type:${this === type}`);
                        nested.push(canvas.toDataURL());
                        context.fillStyle = '#987654';
                        context.fillRect(0, 0, 64, 1);
                        current.push(context.getImageData(0, 0, 64, 1));
                        return 'image/png';
                    },
                };
                if (method === 'toDataURL') {
                    outputs.push(Reflect.apply(canvas.toDataURL, canvas, [type]));
                } else {
                    outputs.push(await new Promise<Blob | null>((resolve) => {
                        const callback = new realm.Proxy((blob: Blob | null): void => {
                            logs[index].push('callback');
                            resolve(blob);
                        }, {});
                        expect(Reflect.apply(canvas.toBlob, canvas, [callback, type])).toBeUndefined();
                        expect(pair.nativeBlobCallbacks[index === 0 ? 'native' : 'protected'][0]).toBe(callback);
                        logs[index].push('return');
                        expectPixels(context.getImageData(0, 0, 64, 1).data, current[index].data);
                        context.fillStyle = '#ffffff';
                        context.fillRect(0, 0, 64, 1);
                        queueMicrotask(() => logs[index].push('microtask'));
                    }));
                }
                expect(() => canvas.getContext('2d')).toThrow();
                expect(context.canvas.getContext('2d')).toBe(context);
                expect(Array.from(context.getTransform().toFloat64Array())).toEqual(transform);
                if (method === 'toDataURL') {
                    expectPixels(context.getImageData(0, 0, 64, 1).data, current[index].data);
                    expect(context.fillStyle).toBe('#987654');
                }
            }
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual(method === 'toDataURL' ? ['type:true']
                : ['type:true', 'return', 'microtask', 'callback']);
            expect(pair.nativeExports.native).toEqual({
                toDataURL: method === 'toDataURL' ? 2 : 1,
                toBlob: method === 'toBlob' ? 1 : 0,
            });
            expect(pair.nativeExports.protected).toEqual(pair.nativeExports.native);
            const outer = pair.nativeIntrinsics.exportPlatform === 'chromium' ? committed : current;
            for (const [selected, source, reference, result] of [
                ['toDataURL', committed[0], nested[0], nested[1]],
                [method, outer[0], outputs[0], outputs[1]],
            ] as const) {
                const baseline = await encodeExpectedSource(pair, source, source.data, selected);
                const baselineDecoded = await decode(baseline, pair.native, pair.nativeIntrinsics);
                const referenceDecoded = await decode(reference, pair.native, pair.nativeIntrinsics);
                expect([baselineDecoded.width, baselineDecoded.height])
                    .toEqual([referenceDecoded.width, referenceDecoded.height]);
                expectPixels(baselineDecoded.data, referenceDecoded.data);
                const protectedSource = referenceSourceNoise(source, pair.seed);
                expectSourceNoise(source, protectedSource);
                const expected = await encodeExpectedSource(pair, source, protectedSource, selected);
                const expectedDecoded = await decode(expected, pair.native, pair.nativeIntrinsics);
                const resultDecoded = await decode(result, pair.protected, pair.protectedIntrinsics);
                expect([resultDecoded.width, resultDecoded.height])
                    .toEqual([expectedDecoded.width, expectedDecoded.height]);
                expectPixels(resultDecoded.data, expectedDecoded.data);
            }
        });
    });

    test.for(methods.flatMap((method) => ['srgb', 'p3', 'float16'].flatMap((mode) => (
        [0, 0.5].map((alpha) => ({ method, mode, alpha }))
    ))))('keeps zero-noise transferred profiles exact: $method $mode $alpha', async ({ method, mode, alpha }) => {
        await withCanvasRealmPair(async (pair) => {
            const contexts = [pair.native, pair.protected].map((realm) => {
                (realm.frameElement as HTMLIFrameElement).hidden = false;
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 24;
                realm.document.body.appendChild(canvas);
                const settings = mode === 'p3' ? { colorSpace: 'display-p3' as const }
                    : { colorType: mode === 'float16' ? 'float16' as const : 'unorm8' as const };
                const context = canvas.transferControlToOffscreen().getContext('2d', settings)!;
                context.fillStyle = '#234567';
                context.fillRect(0, 0, 32, 24);
                return { canvas, context };
            });
            // An opaque publication distinguishes the transferred source from an
            // uninitialized transparent placeholder with no delivered color profile.
            for (const [index, { canvas, context }] of contexts.entries()) {
                await waitForPlaceholder(pair, canvas, context, index === 1, true);
            }
            for (const { context } of contexts) {
                context.clearRect(0, 0, 32, 24);
                context.fillStyle = `rgba(35,69,103,${alpha})`;
                context.fillRect(0, 0, 32, 24);
            }
            for (const [index, { canvas, context }] of contexts.entries()) {
                await waitForPlaceholder(pair, canvas, context, index === 1, true);
            }
            const before = contexts.map(({ context }) => Array.from(context.getImageData(0, 0, 32, 24).data));
            let hooks = 0;
            const objectQuality = Object.freeze({
                [Symbol.toPrimitive](): never { hooks += 1; throw new Error('Unexpected quality conversion'); },
                valueOf(): never { hooks += 1; throw new Error('Unexpected quality conversion'); },
            });
            for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/unknown']) {
                for (const quality of [0.25, objectQuality]) {
                    const reference = await encode(contexts[0].canvas, method, [mime, quality]);
                    const result = await encode(contexts[1].canvas, method, [mime, quality]);
                    expect(typeof result).toBe(typeof reference);
                    if (typeof reference === 'string') {
                        expect(result).toBe(reference);
                    } else {
                        expect((result as Blob).type).toBe(reference!.type);
                        expectPixels(await exportBytes(result), await exportBytes(reference));
                    }
                }
            }
            expect(hooks).toBe(0);
            expect(pair.nativeExports.native[method]).toBe(8);
            expect(pair.nativeExports.protected[method]).toBe(8);
            contexts.forEach(({ canvas, context }, index) => {
                expectPixels(context.getImageData(0, 0, 32, 24).data, before[index]);
                expect(() => canvas.getContext('2d')).toThrow();
            });
        });
    });

    test.each(methods)('preserves native transferred errors and actual callbacks for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const errors: unknown[] = [];
            const outputs: (string | Blob | null | undefined)[] = [];
            const symbols: unknown[] = [];
            const callbacks: unknown[] = [];
            const logs: string[][] = [[], []];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 4;
                canvas.height = 3;
                const context = canvas.transferControlToOffscreen().getContext('2d')!;
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
                expect((thrown(() => context.getImageData(0, 0, 4, 3)) as Error).name).toBe('SecurityError');
                (realm.frameElement as HTMLIFrameElement).hidden = false;
                realm.document.body.appendChild(canvas);
                await new Promise<void>((resolve) => realm.requestAnimationFrame(() => {
                    realm.requestAnimationFrame(() => resolve());
                }));
                const type = { toString(): string { logs[index].push('type'); return 'image/png'; } };
                try {
                    const result = method === 'toDataURL' ? Reflect.apply(canvas.toDataURL, canvas, [type])
                        : await new Promise<Blob | null>((resolve) => {
                            Reflect.apply(canvas.toBlob, canvas, [(blob: Blob | null): void => {
                                logs[index].push('callback');
                                resolve(blob);
                            }, type]);
                        });
                    outputs.push(result);
                    errors.push(undefined);
                } catch (error) {
                    outputs.push(undefined);
                    errors.push(error);
                }
                symbols.push(thrown(() => Reflect.apply(
                    canvas[method],
                    canvas,
                    method === 'toBlob' ? [(): void => { logs[index].push('callback'); }, Symbol('type')]
                        : [Symbol('type')],
                )));
                if (method === 'toBlob') {
                    callbacks.push(thrown(() => Reflect.apply(canvas.toBlob, canvas, [null, type])));
                }
                const value = new realm.URIError('Original transferred conversion failure');
                const badType = { toString(): never { throw value; } };
                expect(thrown(() => Reflect.apply(
                    canvas[method],
                    canvas,
                    method === 'toBlob' ? [(): void => { logs[index].push('callback'); }, badType] : [badType],
                )))
                    .toBe(value);
                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(logs[index]).toEqual(method === 'toBlob' && errors[index] === undefined
                    ? ['type', 'callback'] : ['type']);
                expect(() => canvas.getContext('2d')).toThrow();
                expectPixels([canvas.width, canvas.height], [4, 3]);
                expect(context.fillStyle).toBe('#000000');
            }
            expect(logs[1]).toEqual(logs[0]);
            if (errors[0] === undefined) {
                expect(errors[1]).toBeUndefined();
                expectPixels(await exportBytes(outputs[1]!), await exportBytes(outputs[0]!));
            } else {
                expectError(errors[0], errors[1], pair);
            }
            expectError(symbols[0], symbols[1], pair);
            if (method === 'toBlob') {
                expectError(callbacks[0], callbacks[1], pair);
            }
            expect(pair.nativeExports.native[method]).toBe(method === 'toBlob' ? 4 : 3);
            expect(pair.nativeExports.protected[method]).toBe(method === 'toBlob' ? 4 : 3);
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

    test.each(methods)('observes context modes and transparency after type conversion for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const colorSpace of ['srgb', 'display-p3'] as const) {
                for (const transition of ['first-context', 'opaque-to-transparent']) {
                    const images: ImageData[] = [];
                    const raws: ImageData[] = [];
                    const attributes: CanvasRenderingContext2DSettings[] = [];
                    for (const [index, realm] of [pair.native, pair.protected].entries()) {
                        const canvas = realm.document.createElement('canvas');
                        canvas.width = 32;
                        canvas.height = 24;
                        let context: CanvasRenderingContext2D | undefined;
                        if (transition === 'opaque-to-transparent') {
                            context = canvas.getContext('2d', { colorSpace })!;
                            context.fillStyle = '#234567';
                            context.fillRect(0, 0, 32, 24);
                        }
                        let conversions = 0;
                        const type = {
                            toString(): string {
                                conversions += 1;
                                context ??= canvas.getContext('2d', { colorSpace })!;
                                if (transition === 'first-context') {
                                    context.fillStyle = '#234567';
                                    context.fillRect(0, 0, 32, 24);
                                } else {
                                    context.clearRect(0, 0, 32, 24);
                                }
                                return 'image/png';
                            },
                        };
                        const output = await encode(canvas, method, [type]);
                        expect(conversions).toBe(1);
                        expect(canvas.getContext('2d')).toBe(context);
                        attributes.push(context!.getContextAttributes());
                        raws.push(context!.getImageData(0, 0, 32, 24));
                        images.push(await decode(
                            output,
                            realm,
                            index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics,
                        ));
                    }
                    expect(attributes[1]).toEqual(attributes[0]);
                    expectPixels(images[1].data, attributes[0].colorSpace === 'srgb' ? raws[1].data : images[0].data);
                }
            }
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
    test.each(createCanvasFixtures(100))('agrees between decoded PNG full and partial readouts %#', async (fixture) => {
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
            for (let repeat = 0; repeat < 20; repeat += 1) {
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
            expect(pair.nativeExports.protected).toEqual({ toDataURL: 20, toBlob: 20 });
        });
    }, 30000);

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

    test.each(methods)('preserves export argument conversions and failure order for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const logs: string[][] = [[], []];
            const outputs: ImageData[] = [];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const context = createCanvasFixtures(1)[0].draw(realm);
                const type = Object.freeze({
                    [Symbol.toPrimitive](hint: string): string {
                        logs[index].push(`type:${hint}:${this === type}`);
                        context.canvas.width = 41;
                        context.fillStyle = '#234567';
                        context.fillRect(0, 0, 41, context.canvas.height);
                        return 'image/png';
                    },
                });
                const quality = { valueOf(): never { throw new Error('quality'); } };
                const result = await encode(context.canvas, method, [type, quality]);
                const intrinsics = index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics;
                outputs.push(await decode(result, realm, intrinsics));
                expect(context.canvas.width).toBe(41);
                expect(context.fillStyle).toBe('#234567');
            }
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual(['type:string:true']);
            expect(outputs[1].width).toBe(outputs[0].width);
            expect(Array.from(outputs[1].data).some((value, index) => value !== outputs[0].data[index])).toBe(true);
            expect(pair.nativeExports.protected[method]).toBe(1);
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

    test.each(methods)('records rejected object type diagnostics once for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            const logs: string[][] = [[], []];
            const exceptions: unknown[] = [];
            for (const [index, realm] of [pair.native, pair.protected].entries()) {
                const canvas = realm.document.createElement('canvas');
                const original = new realm.Number(1.8);
                Object.defineProperty(original, Symbol.toPrimitive, {
                    value(hint: string): object { logs[index].push(`${hint}:${this === original}`); return {}; },
                });
                Object.freeze(original);
                let callbacks = 0;
                exceptions.push(thrown(() => Reflect.apply(
                    canvas[method],
                    canvas,
                    method === 'toBlob' ? [(): void => { callbacks += 1; }, original] : [original],
                )));
                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(callbacks).toBe(0);
            }
            expect(logs[1]).toEqual(logs[0]);
            expect(logs[0]).toEqual(['string:true']);
            if (!navigator.userAgent.includes('Firefox/')) {
                expectError(exceptions[0], exceptions[1], pair);
            } else {
                expect(exceptions[0]).toBeInstanceOf(pair.native.TypeError);
                expect(exceptions[1]).toBeInstanceOf(pair.protected.TypeError);
                expect((exceptions[1] as Error).message).toContain('returned an object');
            }
            expect(pair.nativeExports.protected[method]).toBe(1);
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
            expectError(symbolErrors[0], symbolErrors[1], pair);
            if (method === 'toBlob') {
                invalidCallbacks.forEach(([reference, actual]) => expectError(reference, actual, pair));
            }
        });
    });

    test.each(methods)('retains conversion throws without failed callback delivery for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const realm of [pair.native, pair.protected]) {
                const canvas = realm.document.createElement('canvas');
                let count = 0;
                let callbacks = 0;
                const exception = new realm.URIError('original conversion');
                const type = Object.freeze({ toString(): never { count += 1; throw exception; } });
                expect(thrown(() => Reflect.apply(
                    canvas[method],
                    canvas,
                    method === 'toBlob' ? [(): void => { callbacks += 1; }, type] : [type],
                ))).toBe(exception);
                expect(count).toBe(1);
                await new Promise((resolve) => setTimeout(resolve, 20));
                expect(callbacks).toBe(0);
            }
            expect(pair.nativeExports.protected[method]).toBe(1);
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

    test.each(methods)('keeps native empty and unsupported MIME results for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const [width, height] of [[0, 5], [5, 0], [0, 0], [32768, 1]]) {
                const results: (string | Blob | null)[] = [];
                const logs: string[][] = [[], []];
                for (const [index, realm] of [pair.native, pair.protected].entries()) {
                    const canvas = realm.document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const type = { toString(): string { logs[index].push('type'); return 'foo/bar'; } };
                    results.push(await encode(canvas, method, [type]));
                    expect(canvas.getContext('webgl')).not.toBeNull();
                }
                expect(logs[1]).toEqual(logs[0]);
                if (typeof results[0] === 'string') {
                    expect(results[1]).toBe(results[0]);
                } else if (results[0] === null) {
                    expect(results[1]).toBeNull();
                } else {
                    expect((results[1] as Blob).type).toBe((results[0] as Blob).type);
                    expect(Array.from(new Uint8Array(await (results[1] as Blob).arrayBuffer())))
                        .toEqual(Array.from(new Uint8Array(await results[0].arrayBuffer())));
                }
            }
        });
    });

    test.each(methods)('preserves original WebGL bitmap and drawing state during export for %s', async (method) => {
        await withCanvasRealmPair(async (pair) => {
            for (const realm of [pair.native, pair.protected]) {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 24;
                const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
                expect(gl).not.toBeNull();
                gl.clearColor(0.25, 0.5, 0.75, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                const before = new Uint8Array(32 * 24 * 4);
                gl.readPixels(0, 0, 32, 24, gl.RGBA, gl.UNSIGNED_BYTE, before);
                const result = await encode(canvas, method);
                expect(result).not.toBeNull();
                const after = new Uint8Array(before.length);
                gl.readPixels(0, 0, 32, 24, gl.RGBA, gl.UNSIGNED_BYTE, after);
                expectPixels(after, before);
                expect(canvas.getContext('webgl')).toBe(gl);
                expect(canvas.getContext('2d')).toBeNull();
                expect(Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE))).toEqual([0.25, 0.5, 0.75, 1]);
            }
        });
    });
});
