import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';

import { createCanvasProtectionCode } from '../../../src/lib/common/canvas-protection/code';

import {
    HEIGHT,
    install,
    type Installed,
    readoutKind,
    type Realm,
    snapshot,
    WIDTH,
    withRealm,
} from './generated-realm';
import { referenceSourceNoise } from './noise-reference';

const FILL = [71, 123, 189, 255];

/**
 * Draws an opaque fill in a canvas owned by the given realm.
 *
 * @param realm Canvas owner realm.
 *
 * @returns Its 2D context.
 */
const paint = (realm: Realm): CanvasRenderingContext2D => {
    const canvas = realm.document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d')!;
    context.fillStyle = `rgb(${FILL.slice(0, 3).join(',')})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    return context;
};

/**
 * Computes the protected readout of the fill drawn by {@link paint} or by a frame script.
 *
 * @param installed Seed of the protecting document.
 *
 * @returns Expected RGBA bytes.
 */
const noisedFill = (installed: Installed): number[] => {
    const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (let offset = 0; offset < data.length; offset += 4) {
        data.set(FILL, offset);
    }
    return Array.from(referenceSourceNoise({ data, width: WIDTH, height: HEIGHT } as ImageData, installed.seed));
};

/**
 * Appends a frame to the protected document.
 *
 * @param realm Protected document.
 * @param setup Optional frame attributes set before insertion.
 *
 * @returns The connected frame element.
 */
const addFrame = (realm: Realm, setup: (frame: HTMLIFrameElement) => void = (): void => {}): HTMLIFrameElement => {
    const frame = realm.document.createElement('iframe');
    setup(frame);
    realm.document.body.appendChild(frame);
    return frame;
};

const loaded = (frame: HTMLIFrameElement): Promise<void> => new Promise((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
});

// A frame script that reads its own canvas and reports to the parent document.
const frameScript = (name: string): string => `<script>
    const canvas = document.createElement('canvas');
    canvas.width = ${WIDTH};
    canvas.height = ${HEIGHT};
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgb(${FILL.slice(0, 3).join(',')})';
    context.fillRect(0, 0, ${WIDTH}, ${HEIGHT});
    const pixels = Array.from(context.getImageData(0, 0, ${WIDTH}, ${HEIGHT}).data);
    parent.postMessage({ name: ${JSON.stringify(name)}, pixels }, '*');
</scr${''}ipt>`;

const received = (realm: Realm, name: string): Promise<number[]> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No report from the ${name} frame`)), 3000);
    realm.addEventListener('message', (event) => {
        if (event.data?.name === name) {
            clearTimeout(timer);
            resolve(event.data.pixels);
        }
    });
});

const childUrl = new URL('./empty.html?child', import.meta.url).href;

describe('canvas protection of same-origin child frames', () => {
    test.each([
        ['contentWindow', (frame: HTMLIFrameElement): Realm => frame.contentWindow as Realm],
        ['contentDocument', (frame: HTMLIFrameElement): Realm => frame.contentDocument!.defaultView as Realm],
        // Chromium returns only SVG documents from this method.
        ...(server.browser === 'firefox' ? [
            ['getSVGDocument', (frame: HTMLIFrameElement): Realm => frame.getSVGDocument()!.defaultView as Realm],
        ] as const : []),
    ] as const)('protects an about:blank frame reached through %s', async (_name, reach) => {
        await withRealm((realm) => {
            const installed = install(realm);
            const child = reach(addFrame(realm));
            expect(child.location.href).toBe('about:blank');
            expect(readoutKind(paint(child), installed)).toBe('noised');
            const nested = reach(addFrame(child));
            expect(readoutKind(paint(nested), installed)).toBe('noised');
        });
    });

    test('adds no keys to the global object of a protected frame', async () => {
        const plain = document.createElement('iframe');
        document.body.appendChild(plain);
        try {
            await withRealm((realm) => {
                install(realm);
                const child = addFrame(realm).contentWindow as Realm;
                const keys = (target: Window): string[] => Reflect.ownKeys(target).map(String).sort();
                expect(keys(child)).toEqual(keys(plain.contentWindow!));
            });
        } finally {
            plain.remove();
        }
    });

    test.each([
        ['srcdoc', (frame: HTMLIFrameElement): void => { frame.srcdoc = frameScript('srcdoc'); }],
        ['blob', (frame: HTMLIFrameElement, realm: Realm): void => {
            frame.src = realm.URL.createObjectURL(new realm.Blob([frameScript('blob')], { type: 'text/html' }));
        }],
        ['javascript', (frame: HTMLIFrameElement): void => {
            frame.src = `javascript:${JSON.stringify(frameScript('javascript'))}`;
        }],
    ] as const)('protects a script running inside a %s frame the page never touched', async (name, setup) => {
        await withRealm(async (realm) => {
            const installed = install(realm);
            const report = received(realm, name);
            const holder = realm.document.createElement('div');
            const frame = realm.document.createElement('iframe');
            setup(frame, realm);
            // Inserted as markup, so no frame element member is read.
            holder.innerHTML = frame.outerHTML;
            realm.document.body.appendChild(holder);
            expect(await report).toEqual(noisedFill(installed));
        });
    });

    test('protects a document written into an about:blank frame', async () => {
        await withRealm(async (realm) => {
            const installed = install(realm);
            const report = received(realm, 'written');
            const { contentDocument } = addFrame(realm);
            contentDocument!.open();
            contentDocument!.write(frameScript('written'));
            contentDocument!.close();
            expect(contentDocument!.location.href).not.toBe('about:blank');
            expect(await report).toEqual(noisedFill(installed));
        });
    });

    test('protects a frame found by index once the inserting script has finished', async () => {
        await withRealm(async (realm) => {
            const installed = install(realm);
            const index = realm.length;
            addFrame(realm);
            const child = realm[index] as Realm;
            await Promise.resolve();
            expect(readoutKind(paint(child), installed)).toBe('noised');
        });
    });

    test('shares draw marks and native representations across its frames', async () => {
        await withRealm((realm) => {
            const natives = [realm.CanvasRenderingContext2D.prototype.getImageData, realm.Function.prototype.toString];
            const installed = install(realm);
            const child = addFrame(realm).contentWindow as Realm;
            const canvas = realm.document.createElement('canvas');
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            const context = canvas.getContext('2d')!;
            const image = new realm.ImageData(WIDTH, HEIGHT);
            for (let offset = 0; offset < image.data.length; offset += 4) {
                image.data.set(FILL, offset);
            }
            context.putImageData(image, 0, 0);
            expect(readoutKind(context, installed)).toBe('native');
            // Rendering through the frame's method marks the parent's canvas too.
            Reflect.apply(child.CanvasRenderingContext2D.prototype.fillRect, context, [0, 0, 0, 0]);
            expect(readoutKind(context, installed)).toBe('noised');
            expect(Array.from(Reflect.apply(child.CanvasRenderingContext2D.prototype.getImageData, context, [
                0, 0, WIDTH, HEIGHT,
            ]).data)).toEqual(noisedFill(installed));
            const representation = Reflect.apply(natives[1], natives[0], []);
            const wrappers = [realm, child].map((owner) => owner.CanvasRenderingContext2D.prototype.getImageData);
            [realm, child].forEach((owner) => wrappers.forEach((wrapper) => {
                expect(Reflect.apply(owner.Function.prototype.toString, wrapper, [])).toBe(representation);
            }));
            const frameGetter = (owner: Realm): Function => (
                Object.getOwnPropertyDescriptor(owner.HTMLIFrameElement.prototype, 'contentWindow')!.get!
            );
            expect(Reflect.apply(realm.Function.prototype.toString, frameGetter(child), [])).toBe(
                Reflect.apply(natives[1], frameGetter(window), []),
            );
        });
    });

    test('answers only the private tokens of its browser run', async () => {
        await withRealm((realm) => {
            const native = realm.CanvasRenderingContext2D.prototype.getImageData;
            install(realm);
            const wrapper = realm.CanvasRenderingContext2D.prototype.getImageData;
            const failure = (method: Function, args: unknown[]): string => {
                try {
                    Reflect.apply(method, undefined, args);
                } catch (error) {
                    expect(error).toBeInstanceOf(realm.TypeError);
                    return (error as Error).message;
                }
                throw new Error('Expected an illegal invocation');
            };
            [[], ['probe'], ['0123456789abcdef'], ['0123456789abcdef', 1]].forEach((args) => {
                expect(failure(wrapper, args)).toBe(failure(native, args));
            });
        });
    });

    test('keeps a reused frame realm native until its own document is protected', async () => {
        await withRealm(async (realm) => {
            const state = snapshot();
            const installed = install(realm);
            const frame = addFrame(realm, (element) => { element.src = childUrl; });
            const child = frame.contentWindow as Realm;
            const wrapper = child.CanvasRenderingContext2D.prototype.getImageData;
            expect(child.location.href).toBe('about:blank');
            expect(readoutKind(paint(child), installed)).toBe('noised');
            await loaded(frame);
            // The same-origin document reuses the realm of the initial about:blank document.
            expect(child.location.href).toBe(childUrl);
            expect(child.CanvasRenderingContext2D.prototype.getImageData).toBe(wrapper);
            // No engine decided for this document yet: it may be excluded, so its readouts stay native.
            expect(readoutKind(paint(child), installed)).toBe('native');
            child.eval(createCanvasProtectionCode({
                ...state,
                policy: {
                    ...state.policy,
                    ownFrameExclusions: [{
                        requestTypes: ['subdocument'],
                        condition: {
                            type: 'url-regexp', input: 'frame-url', pattern: 'empty\\.html\\?child', flags: '',
                        },
                    }],
                },
            }));
            expect(readoutKind(paint(child), installed)).toBe('native');
            child.eval(createCanvasProtectionCode(state));
            expect(child.CanvasRenderingContext2D.prototype.getImageData).toBe(wrapper);
            expect(readoutKind(paint(child), installed)).toBe('noised');
            expect(readoutKind(paint(addFrame(child).contentWindow as Realm), installed)).toBe('noised');
        });
    });

    test('leaves frames with their own engine and cross-origin frames alone', async () => {
        const own = document.createElement('iframe');
        own.src = childUrl;
        document.body.appendChild(own);
        try {
            await loaded(own);
            await withRealm(async (realm) => {
                const installed = install(realm);
                const sibling = own.contentWindow as Realm;
                sibling.eval(createCanvasProtectionCode(snapshot()));
                const wrapper = sibling.CanvasRenderingContext2D.prototype.getImageData;
                const reach = Object.getOwnPropertyDescriptor(realm.HTMLIFrameElement.prototype, 'contentWindow')!.get!;
                expect(Reflect.apply(reach, own, [])).toBe(sibling);
                expect(sibling.CanvasRenderingContext2D.prototype.getImageData).toBe(wrapper);
                expect(readoutKind(paint(sibling), installed)).toBe('noised');
                const foreign = addFrame(realm, (element) => { element.src = 'data:text/html,<p>foreign</p>'; });
                await loaded(foreign);
                expect(foreign.contentWindow).not.toBeNull();
                expect(foreign.contentDocument).toBeNull();
            });
        } finally {
            own.remove();
        }
    });
});
