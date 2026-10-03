import { describe, expect, test } from 'vitest';

import { applyCanvasNoise } from '../../../src/lib/common/canvas-protection/noise';

import { createCanvasFixtures } from './fixtures';
import { type CanvasRealmPair, withCanvasRealmPair } from './native-reference';

type Realm = Window & typeof globalThis;
type Invocation = (context: CanvasRenderingContext2D, realm: Realm, log: string[]) => ImageData;
interface Outcome {
    readonly didThrow: boolean;
    readonly result?: ImageData;
    readonly exception?: unknown;
    readonly error?: { constructor?: string; name?: string; message?: string };
}

/**
 * Records native outcome without replacing its exception or inspecting arguments.
 *
 * @param invoke Call against one member of the pair.
 * @param context Original context.
 * @param realm Context's realm.
 * @param log Observable argument-conversion effects.
 *
 * @returns Native result or exact exception surface.
 */
const observe = (invoke: Invocation, context: CanvasRenderingContext2D, realm: Realm, log: string[]): Outcome => {
    try {
        return { didThrow: false, result: invoke(context, realm, log) };
    } catch (error) {
        const exception = error as Error;
        return {
            didThrow: true,
            exception: error,
            error: {
                constructor: exception?.constructor?.name,
                name: exception?.name,
                message: exception?.message,
            },
        };
    }
};

/**
 * Compares the native error category of corresponding fresh-realm exceptions.
 *
 * @param reference Exception thrown by the reference browser binding.
 * @param actual Exception thrown by the protected binding.
 * @param pair Corresponding browser realms.
 *
 * @returns Whether the protected exception preserves the reference constructor category.
 */
const matchesNativeException = (reference: Error, actual: Error, pair: CanvasRealmPair): boolean => {
    const constructors = [
        [pair.native.TypeError, pair.protected.TypeError],
        [pair.native.RangeError, pair.protected.RangeError],
        [pair.native.DOMException, pair.protected.DOMException],
    ] as const;
    const category = constructors.find(([nativeConstructor]) => reference.constructor === nativeConstructor);
    return category !== undefined
        && Object.getPrototypeOf(reference) === category[0].prototype
        && actual.constructor === category[1]
        && Object.getPrototypeOf(actual) === category[1].prototype;
};

/**
 * Exposes browser-provided metadata, including genuinely unsupported formats.
 *
 * @param image Native ImageData.
 *
 * @returns Comparable metadata from actual results.
 */
const metadata = (image: ImageData): object => {
    const extended = image as ImageData & { colorSpace?: string; pixelFormat?: string };
    return {
        width: image.width,
        height: image.height,
        type: image.data.constructor.name,
        colorSpace: extended.colorSpace,
        pixelFormat: extended.pixelFormat,
    };
};

/**
 * Computes expected pointwise output from the native browser's original bytes.
 *
 * @param pair Captured realms and site seed.
 * @param image Successful native result.
 * @param context Original native context after conversions.
 * @param x Normalized absolute origin.
 * @param y Normalized absolute origin.
 *
 * @returns Expected readout bytes.
 */
const expectedPixels = (
    pair: CanvasRealmPair,
    image: ImageData,
    context: CanvasRenderingContext2D,
    x = 0,
    y = 0,
): number[] => {
    const data = new Uint8ClampedArray(image.data);
    const intrinsics = context instanceof pair.native.CanvasRenderingContext2D
        ? pair.nativeIntrinsics : pair.protectedIntrinsics;
    const canvas = Reflect.apply(intrinsics.contextCanvas, context, []) as HTMLCanvasElement;
    applyCanvasNoise({
        data,
        width: image.width,
        height: image.height,
        originX: x,
        originY: y,
        canvasWidth: Reflect.apply(intrinsics.canvasWidth, canvas, []),
        canvasHeight: Reflect.apply(intrinsics.canvasHeight, canvas, []),
        colorSpace: 'srgb',
    }, pair.seed);
    return Array.from(data);
};

/**
 * Calls both browser bindings with independently created, equivalent argument objects.
 *
 * @param invoke Equivalent operation in each realm.
 * @param origin Successful normalized coordinates.
 * @param nativeErrors Whether failures originate from the browser binding rather than a user hook.
 */
const compare = async (
    invoke: Invocation,
    origin: readonly [number, number] = [0, 0],
    nativeErrors = true,
): Promise<void> => {
    await withCanvasRealmPair(async (pair) => {
        const fixture = createCanvasFixtures(1)[0];
        const native = fixture.draw(pair.native);
        const protectedContext = fixture.draw(pair.protected);
        const nativeLog: string[] = [];
        const protectedLog: string[] = [];
        const reference = observe(invoke, native, pair.native, nativeLog);
        const actual = observe(invoke, protectedContext, pair.protected, protectedLog);
        expect(protectedLog).toEqual(nativeLog);
        expect(actual.didThrow).toBe(reference.didThrow);
        expect(actual.error).toEqual(reference.error);
        if (nativeErrors && reference.exception) {
            expect(matchesNativeException(reference.exception as Error, actual.exception as Error, pair)).toBe(true);
        }
        if (reference.result) {
            expect(metadata(actual.result!)).toEqual(metadata(reference.result));
            expect(actual.result).toBeInstanceOf(pair.protected.ImageData);
            expect(Array.from(actual.result!.data)).toEqual(
                expectedPixels(pair, reference.result, native, origin[0], origin[1]),
            );
        }
    });
};

/**
 * Provides observable numeric conversion using original method/getter receivers.
 *
 * @param value Conversion result.
 * @param label Argument label.
 * @param log Observable effects.
 * @param effect Optional draw, resize or nested read.
 *
 * @returns Object converted by the browser's WebIDL binding.
 */
const numeric = (value: unknown, label: string, log: string[], effect?: () => void): object => ({
    get valueOf() {
        log.push(`${label}:get valueOf`);
        const original = this;
        return function valueOf(this: unknown): unknown {
            log.push(`${label}:valueOf:${this === original}`);
            effect?.();
            return value;
        };
    },
});

/**
 * Invokes getImageData without TypeScript limiting deliberately invalid runtime input.
 *
 * @param context Receiver.
 * @param args Actual runtime arguments.
 *
 * @returns Native result if successful.
 */
const read = (context: CanvasRenderingContext2D, args: unknown[]): ImageData => (
    Reflect.apply(context.getImageData, context, args)
);

describe('original canvas size coverage', () => {
    test.each(['x', 'y'])('leaves repeated small crops of oversized original %s native', async (axis) => {
        await withCanvasRealmPair(async (pair) => {
            const contexts = [pair.native, pair.protected].map((realm) => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = axis === 'x' ? 32768 : 1;
                canvas.height = axis === 'y' ? 32768 : 1;
                const context = canvas.getContext('2d')!;
                context.fillStyle = '#234567';
                context.fillRect(0, 0, canvas.width, canvas.height);
                return context;
            });
            for (const offset of [0, 1, 0, 1]) {
                const outcomes = [pair.native, pair.protected].map((realm, index) => observe((context) => (
                    context.getImageData(
                        axis === 'x' ? offset : 0,
                        axis === 'y' ? offset : 0,
                        axis === 'x' ? 256 : 1,
                        axis === 'y' ? 256 : 1,
                    )
                ), contexts[index], realm, []));
                expect(outcomes[1].didThrow).toBe(outcomes[0].didThrow);
                expect(outcomes[1].error).toEqual(outcomes[0].error);
                if (outcomes[0].result) {
                    expect(metadata(outcomes[1].result!)).toEqual(metadata(outcomes[0].result));
                    expect(Array.from(outcomes[1].result!.data)).toEqual(Array.from(outcomes[0].result.data));
                }
            }
            expect(pair.nativeCalls).toEqual({ native: 4, protected: 4 });
        });
    });

    test.each(['x', 'y'])('protects raw crops at inclusive original %s boundary', async (axis) => {
        await withCanvasRealmPair(async (pair) => {
            const contexts = [pair.native, pair.protected].map((realm) => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = axis === 'x' ? 32767 : 1;
                canvas.height = axis === 'y' ? 32767 : 1;
                const context = canvas.getContext('2d')!;
                context.fillStyle = '#234567';
                context.fillRect(0, 0, canvas.width, canvas.height);
                return context;
            });
            const results = contexts.map((context) => context.getImageData(
                0,
                0,
                axis === 'x' ? 256 : 1,
                axis === 'y' ? 256 : 1,
            ));
            expect(pair.nativeCalls).toEqual({ native: 1, protected: 1 });
            expect(Array.from(results[1].data)).toEqual(expectedPixels(pair, results[0], contexts[0]));
            expect(Array.from(results[1].data)).not.toEqual(Array.from(results[0].data));
        });
    });

    test.for(['x', 'y'].flatMap((axis) => ['inside', 'outside'].flatMap((final) => (
        ['coordinate', 'dimension', 'options'].map((hook) => ({ axis, final, hook }))
    ))))('uses final native attributes after $hook conversion: $axis $final', async ({ axis, final, hook }) => {
        await withCanvasRealmPair(async (pair) => {
            const logs: string[][] = [[], []];
            const contexts: CanvasRenderingContext2D[] = [];
            let pageSizeGets = 0;
            const outcomes = [pair.native, pair.protected].map((realm, index) => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = axis === 'x' && final === 'inside' ? 32768 : 1;
                canvas.height = axis === 'y' && final === 'inside' ? 32768 : 1;
                const context = canvas.getContext('2d')!;
                contexts.push(context);
                const resize = (): void => {
                    logs[index].push('resize');
                    const length = final === 'inside' ? 32767 : 32768;
                    Reflect.apply((index === 0 ? pair.nativeIntrinsics : pair.protectedIntrinsics)[
                        axis === 'x' ? 'setCanvasWidth' : 'setCanvasHeight'
                    ], canvas, [length]);
                    context.fillStyle = '#234567';
                    context.fillRect(0, 0, axis === 'x' ? length : 1, axis === 'y' ? length : 1);
                };
                Object.defineProperties(canvas, {
                    width: { get: (): number => { pageSizeGets += 1; return 1; } },
                    height: { get: (): number => { pageSizeGets += 1; return 1; } },
                });
                const args: unknown[] = [0, 0, axis === 'x' ? 256 : 1, axis === 'y' ? 256 : 1];
                if (hook === 'coordinate' || hook === 'dimension') {
                    const argument = hook === 'coordinate' ? 0 : 2;
                    args[argument] = numeric(args[argument], hook, logs[index], resize);
                } else {
                    args.push({ get colorSpace(): string { resize(); return 'srgb'; } });
                }
                return observe((receiver) => read(receiver, args), context, realm, logs[index]);
            });
            expect(pair.nativeCalls).toEqual({ native: 1, protected: 1 });
            expect(pageSizeGets).toBe(0);
            expect(logs[1]).toEqual(logs[0]);
            const resizeCount = logs[0].filter((entry) => entry === 'resize').length;
            if (hook === 'options') {
                expect(resizeCount).toBeLessThanOrEqual(1);
            } else {
                expect(resizeCount).toBe(1);
            }
            expect(outcomes[1].didThrow).toBe(outcomes[0].didThrow);
            expect(outcomes[1].error).toEqual(outcomes[0].error);
            if (outcomes[0].result) {
                expect(metadata(outcomes[1].result!)).toEqual(metadata(outcomes[0].result));
                const nativeWidth = Reflect.apply(pair.nativeIntrinsics.canvasWidth, contexts[0].canvas, []);
                const nativeHeight = Reflect.apply(pair.nativeIntrinsics.canvasHeight, contexts[0].canvas, []);
                const inside = nativeWidth <= 32767 && nativeHeight <= 32767;
                const expected = inside ? expectedPixels(pair, outcomes[0].result, contexts[0])
                    : Array.from(outcomes[0].result.data);
                expect(Array.from(outcomes[1].result!.data)).toEqual(expected);
            }
        });
    });
});

describe('preserves native receiver errors and conversion order', () => {
    test('rejects a wrong-realm native error with identical name and message', async () => withCanvasRealmPair(
        async (pair) => {
            const fixture = createCanvasFixtures(1)[0];
            const context = fixture.draw(pair.native);
            const invoke: Invocation = (_context, realm) => Reflect.apply(
                realm.CanvasRenderingContext2D.prototype.getImageData,
                undefined,
                [0, 0, 1, 1],
            );
            const outcome = observe(invoke, context, pair.native, []);
            const actual = new pair.native.TypeError((outcome.exception as Error).message);
            expect(matchesNativeException(outcome.exception as Error, actual, pair)).toBe(false);
        },
    ));

    test.each(['undefined', 'null', 'object', 'canvas', 'proxy'])(
        '%s receiver validates before conversion',
        async (kind) => compare((context, realm, log) => {
            const receivers: Record<string, unknown> = {
                undefined,
                null: null,
                object: {},
                canvas: context.canvas,
                proxy: new Proxy(context, {}),
            };
            return Reflect.apply(
                realm.CanvasRenderingContext2D.prototype.getImageData,
                receivers[kind],
                [numeric(0, 'sx', log), 0, 1, 1],
            );
        }),
    );

    test.each([0, 1, 2, 3])(
        'missing arguments %i reject before conversions',
        async (count) => compare((context, _realm, log) => read(
            context,
            Array.from({ length: count }, () => numeric(0, 'arg', log)),
        )),
    );

    test.each(['call', 'apply', 'detached'])(
        '%s uses native receiver and ignores extra arguments',
        async (mode) => compare((context, _realm, log) => {
            const method = context.getImageData;
            const args = [0, 0, 32, 24, undefined, numeric(1, 'extra', log)];
            if (mode === 'call') {
                return method.call(context, ...args as [number, number, number, number]);
            }
            if (mode === 'apply') {
                return method.apply(context, args as [number, number, number, number]);
            }
            context.canvas.remove();
            return Reflect.apply(method, context, args);
        }),
    );

    test('left-to-right conversion getters and original this run once', async () => compare((context, _realm, log) => (
        read(context, [numeric(0, 'sx', log), numeric(0, 'sy', log), numeric(32, 'sw', log), numeric(24, 'sh', log)])
    )));

    test('Symbol.toPrimitive receives number hint and original object', async () => compare((context, _realm, log) => {
        const value = {
            get [Symbol.toPrimitive]() {
                log.push('get primitive');
                const original = this;
                return function convert(this: unknown, hint: string): number {
                    log.push(`primitive:${hint}:${this === original}`);
                    return 0;
                };
            },
        };
        return read(context, [value, 0, 32, 24]);
    }));

    test('ordinary conversion fallback preserves getter order', async () => compare((context, _realm, log) => {
        const value = {
            get valueOf() { log.push('get valueOf'); return (): object => { log.push('valueOf'); return {}; }; },
            get toString() { log.push('get toString'); return (): string => { log.push('toString'); return '0'; }; },
        };
        return read(context, [value, 0, 32, 24]);
    }));

    test.each(['valueOf', 'primitive'])(
        'frozen %s method keeps original receiver and single conversion',
        async (kind) => compare((context, _realm, log) => {
            const value: object = kind === 'valueOf' ? {
                valueOf(this: unknown): number { log.push(`valueOf:${this === value}`); return 0; },
            } : {
                [Symbol.toPrimitive](this: unknown, hint: string): number {
                    log.push(`primitive:${hint}:${this === value}`); return 0;
                },
            };
            return read(context, [Object.freeze(value), 0, 32, 24]);
        }),
    );

    test('thrown user conversion aborts later conversions and preserves cross-realm identity', async () => (
        withCanvasRealmPair(async (pair) => {
            const fixture = createCanvasFixtures(1)[0];
            const thrown = new RangeError('conversion');
            const outcomes = [pair.native, pair.protected].map((realm) => {
                const log: string[] = [];
                const outcome = observe((context) => read(context, [
                    numeric(0, 'sx', log, () => { throw thrown; }), numeric(0, 'sy', log), 32, 24,
                ]), fixture.draw(realm), realm, log);
                expect(outcome.exception).toBe(thrown);
                return { log, outcome };
            });
            expect(outcomes[1].log).toEqual(outcomes[0].log);
            expect(outcomes[0].log).toEqual(['sx:get valueOf', 'sx:valueOf:true']);
            expect(outcomes[1].outcome.error).toEqual(outcomes[0].outcome.error);
        })
    ));

    test('drawing and resizing during conversion determine native snapshot', async () => compare(
        (context, _realm, log) => (
            read(context, [numeric(0, 'sx', log, () => {
                context.canvas.width = 20;
                context.canvas.height = 16;
                context.fillStyle = '#204060';
                context.fillRect(0, 0, 20, 16);
            }), 0, 32, 24])
        ),
    ));
});

describe('normalizes coordinates once and leaves padding native', () => {
    test.each([
        [0, 0, 32, 24], [-4, -3, 40, 30], [5, 7, -8, -10],
        [5.9, 7.9, -8.9, -10.9], [-0.9, -0.9, 10.9, 12.9], [1.9, 2.9, 8.9, 7.9],
        [2147483647, 0, 1, 1], [-2147483648, 0, 1, 1], [2147483648, 0, 1, 1],
        [-2147483649, 0, 1, 1], [NaN, 0, 1, 1], [Infinity, 0, 1, 1], [-Infinity, 0, 1, 1],
        [NaN, Infinity, 32, 24], [Infinity, -Infinity, 32, 24],
        [4294967296, 4294967296, 32, 24], [4294967301, 4294967303, 16, 12],
        [-4294967296, -4294967296, 32, 24], [0, 0, 4294967328, 4294967320],
        [0, 0, NaN, 1], [0, 0, 2147483648, 1], [0, 0, 0, 1], [0, 0, 1, 0],
        [0, 0, 0.9, 1], [0, 0, 1, -0.9],
    ])('matches native rectangle %j', async (sx, sy, sw, sh) => {
        const x = Math.trunc(sx) + Math.min(0, Math.trunc(sw));
        const y = Math.trunc(sy) + Math.min(0, Math.trunc(sh));
        await compare((context, _realm, log) => read(context, [numeric(sx, 'sx', log), numeric(sy, 'sy', log),
            numeric(sw, 'sw', log), numeric(sh, 'sh', log)]), [x, y]);
    });

    test('rejects non-finite and out-of-range coordinates before returning pixels', async () => (
        withCanvasRealmPair(async (pair) => {
            const native = createCanvasFixtures(1)[0].draw(pair.native);
            const protectedContext = createCanvasFixtures(1)[0].draw(pair.protected);
            for (const value of [NaN, Infinity, -Infinity, 4294967296, 4294967301]) {
                expect(() => read(native, [value, 0, 32, 24])).toThrow(pair.native.TypeError);
                expect(() => read(protectedContext, [value, 0, 32, 24])).toThrow(pair.protected.TypeError);
            }
        })
    ));

    test('overlapping crop output agrees at absolute coordinates', async () => withCanvasRealmPair(async (pair) => {
        const fixture = createCanvasFixtures(1)[0];
        const native = fixture.draw(pair.native);
        const context = fixture.draw(pair.protected);
        const whole = context.getImageData(0, 0, fixture.width, fixture.height);
        const crop = context.getImageData(5, 7, 12, 8);
        expect(Array.from(crop.data)).toEqual(expectedPixels(pair, native.getImageData(5, 7, 12, 8), native, 5, 7));
        for (let y = 0; y < crop.height; y += 1) {
            for (let x = 0; x < crop.width; x += 1) {
                const offset = ((y + 7) * whole.width + x + 5) * 4;
                expect(Array.from(crop.data.slice((y * crop.width + x) * 4, (y * crop.width + x + 1) * 4)))
                    .toEqual(Array.from(whole.data.slice(offset, offset + 4)));
            }
        }
        const original = native.getImageData(0, 0, fixture.width, fixture.height);
        expect(Array.from(whole.data)).not.toEqual(Array.from(original.data));
    }));
});

describe('keeps unsupported pixel formats and color spaces native', () => {
    test.each([
        undefined, {}, { colorSpace: 'srgb' }, { colorSpace: 'display-p3' },
        { pixelFormat: 'rgba-float16' }, { colorSpace: 'display-p3', pixelFormat: 'rgba-float16' },
        { colorSpace: 'invalid' }, { pixelFormat: 'invalid' },
    ])('uses actual browser result for settings %j', async (settings) => withCanvasRealmPair(async (pair) => {
        const fixture = createCanvasFixtures(1)[0];
        const native = fixture.draw(pair.native);
        const protectedContext = fixture.draw(pair.protected);
        const invoke: Invocation = (context) => read(context, [0, 0, 32, 24, settings]);
        const reference = observe(invoke, native, pair.native, []);
        const actual = observe(invoke, protectedContext, pair.protected, []);
        expect(actual.didThrow).toBe(reference.didThrow);
        expect(actual.error).toEqual(reference.error);
        if (reference.exception) {
            expect(matchesNativeException(reference.exception as Error, actual.exception as Error, pair)).toBe(true);
        }
        if (reference.result) {
            expect(metadata(actual.result!)).toEqual(metadata(reference.result));
            const supported = reference.result.data instanceof pair.native.Uint8ClampedArray
                && (reference.result.colorSpace === undefined || reference.result.colorSpace === 'srgb');
            expect(Array.from(actual.result!.data)).toEqual(supported
                ? expectedPixels(pair, reference.result, native) : Array.from(reference.result.data));
        }
    }));

    test.each(['colorSpace', 'pixelFormat'])(
        'settings %s getter retains native count, order and errors',
        async (property) => compare((context, realm, log) => {
            const thrown = new realm.SyntaxError('settings');
            const settings = {
                get colorSpace(): string {
                    log.push('colorSpace');
                    if (property === 'colorSpace') { throw thrown; }
                    return 'srgb';
                },
                get pixelFormat(): string {
                    log.push('pixelFormat');
                    if (property === 'pixelFormat') { throw thrown; }
                    return 'rgba-unorm8';
                },
            };
            try {
                return read(context, [0, 0, 32, 24, settings]);
            } catch (error) {
                expect(error).toBe(thrown);
                throw error;
            }
        }, [0, 0], false),
    );

    test('settings conversion side effects precede the snapshot without extra reads', async () => compare(
        (context, _realm, log) => read(context, [0, 0, 32, 24, {
            get colorSpace(): string {
                log.push('colorSpace');
                context.fillStyle = '#456789';
                context.resetTransform();
                context.globalAlpha = 1;
                context.fillRect(0, 0, 32, 24);
                return 'srgb';
            },
            get pixelFormat(): string { log.push('pixelFormat'); return 'rgba-unorm8'; },
        }]),
    ));

    test.each(['display-p3', 'float16'])(
        'context %s preserves actual native readout mode',
        async (mode) => withCanvasRealmPair(async (pair) => {
            const contexts = [pair.native, pair.protected].map((realm) => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 24;
                const options = mode === 'display-p3' ? { colorSpace: 'display-p3' } : { colorType: 'float16' };
                const context = canvas.getContext('2d', options as CanvasRenderingContext2DSettings)!;
                context.fillStyle = '#123456';
                context.fillRect(0, 0, 32, 24);
                return context;
            });
            const reference = contexts[0].getImageData(0, 0, 32, 24);
            const actual = contexts[1].getImageData(0, 0, 32, 24);
            expect(metadata(actual)).toEqual(metadata(reference));
            const supported = reference.data instanceof pair.native.Uint8ClampedArray
                && (reference.colorSpace === undefined || reference.colorSpace === 'srgb');
            expect(Array.from(actual.data)).toEqual(supported
                ? expectedPixels(pair, reference, contexts[0]) : Array.from(reference.data));
        }),
    );

    test.for(['display-p3', 'float16'].flatMap((storage) => [
        undefined,
        { colorSpace: 'srgb', pixelFormat: 'rgba-unorm8' },
        { colorSpace: 'display-p3', pixelFormat: 'rgba-unorm8' },
        { colorSpace: 'srgb', pixelFormat: 'rgba-float16' },
    ].map((settings) => ({ storage, settings }))))(
        'classifies actual returned mode from $storage storage with $settings',
        async ({ storage, settings }, { annotate }) => withCanvasRealmPair(async (pair) => {
            const contexts = [pair.native, pair.protected].map((realm) => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 24;
                const options = storage === 'display-p3' ? { colorSpace: 'display-p3' } : { colorType: 'float16' };
                const context = canvas.getContext('2d', options as CanvasRenderingContext2DSettings)!;
                context.fillStyle = '#234567';
                context.fillRect(0, 0, 32, 24);
                return context;
            });
            const originals = contexts.map((context, index) => Array.from(Reflect.apply(
                index === 0 ? pair.nativeIntrinsics.getImageData : pair.protectedIntrinsics.getImageData,
                context,
                [0, 0, 32, 24, settings],
            ).data));
            const attributes = contexts.map((context) => context.getContextAttributes());
            const modes: object[] = [];
            for (const [x, y, width, height] of [[0, 0, 32, 24], [3, 4, 12, 13], [0, 0, 32, 24]]) {
                const results = contexts.map((context) => read(context, [x, y, width, height, settings]));
                expect(metadata(results[1])).toEqual(metadata(results[0]));
                const supported = results[0].data instanceof pair.native.Uint8ClampedArray
                    && (results[0].colorSpace === undefined || results[0].colorSpace === 'srgb');
                const expected = supported ? expectedPixels(pair, results[0], contexts[0], x, y)
                    : Array.from(results[0].data);
                modes.push({ result: metadata(results[0]), supported });
                expect(Array.from(results[1].data)).toEqual(expected);
                if (supported) {
                    expect(Array.from(results[1].data)).not.toEqual(Array.from(results[0].data));
                }
            }
            await annotate(JSON.stringify({
                storage, settings, attributes, modes,
            }), 'actual-raw-readout-mode');
            expect(pair.nativeCalls).toEqual({ native: 3, protected: 3 });
            contexts.forEach((context, index) => {
                expect(context.getContextAttributes()).toEqual(attributes[index]);
                expect(context.canvas.getContext('2d')).toBe(context);
                expect(Array.from(Reflect.apply(
                    index === 0
                        ? pair.nativeIntrinsics.getImageData : pair.protectedIntrinsics.getImageData,
                    context,
                    [0, 0, 32, 24, settings],
                ).data)).toEqual(originals[index]);
            });
        }),
    );
});

describe('does not mutate canvas or double-noise reentrant reads', () => {
    test.each([0, 1, 2, 3, 4, 5])(
        'keeps fixture %i bitmap, dimensions, context and drawing state',
        async (index) => withCanvasRealmPair(async (pair) => {
            const fixture = createCanvasFixtures(6)[index];
            const native = fixture.draw(pair.native);
            const context = fixture.draw(pair.protected);
            const result = context.getImageData(0, 0, fixture.width, fixture.height);
            const original = Reflect.apply(
                pair.protectedIntrinsics.getImageData,
                context,
                [0, 0, fixture.width, fixture.height],
            ) as ImageData;
            const reference = native.getImageData(0, 0, fixture.width, fixture.height);
            expect(Array.from(original.data)).toEqual(Array.from(reference.data));
            expect(Array.from(result.data)).toEqual(expectedPixels(pair, original, context));
            expect(context.canvas.width).toBe(fixture.width);
            expect(context.canvas.height).toBe(fixture.height);
            expect(context.canvas.getContext('2d')).toBe(context);
            expect(context.fillStyle).toBe(fixture.state.fillStyle);
            expect(context.globalAlpha).toBe(fixture.state.globalAlpha);
            expect(context.lineWidth).toBe(fixture.state.lineWidth);
            expect(Array.from(context.getTransform().toFloat64Array()))
                .toEqual(Array.from(native.getTransform().toFloat64Array()));
            context.stroke();
            native.stroke();
            expect(Array.from(Reflect.apply(
                pair.protectedIntrinsics.getImageData,
                context,
                [0, 0, fixture.width, fixture.height],
            ).data)).toEqual(
                Array.from(native.getImageData(0, 0, fixture.width, fixture.height).data),
            );
        }),
    );

    test('nested conversion read and outer read each apply noise once', async () => compare((context, _realm, log) => {
        const inner: number[][] = [];
        const result = read(context, [numeric(0, 'sx', log, () => {
            inner.push(Array.from(context.getImageData(0, 0, 32, 24).data));
        }), 0, 32, 24]);
        expect(inner[0]).toEqual(Array.from(result.data));
        return result;
    }));

    test('captured accessors avoid page-owned canvas and dimension getters', async () => compare(
        (context, _realm, log) => {
            const { canvas } = context;
            Object.defineProperty(context, 'canvas', {
                get: (): never => { log.push('canvas'); throw new Error('canvas'); },
            });
            Object.defineProperty(canvas, 'width', {
                get: (): never => { log.push('width'); throw new Error('width'); },
            });
            Object.defineProperty(canvas, 'height', {
                get: (): never => { log.push('height'); throw new Error('height'); },
            });
            return read(context, [0, 0, 32, 24]);
        },
    ));
});
