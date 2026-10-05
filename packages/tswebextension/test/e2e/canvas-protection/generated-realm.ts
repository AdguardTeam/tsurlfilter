import { expect } from 'vitest';
import { server } from 'vitest/browser';

import { CanvasProtectionCode } from '../../../src/lib/common/canvas-protection/code';
import { CanvasPolicyBrowser } from '../../../src/lib/common/canvas-protection/constants';
import { type CanvasBootstrapSnapshot } from '../../../src/lib/common/canvas-protection/contracts';
import { deriveSiteSeed } from '../../../src/lib/common/canvas-protection/noise';

import { referenceSourceNoise } from './noise-reference';

export type Realm = Window & typeof globalThis;

/**
 * Creates trusted current delivery state.
 *
 * @returns A policy without exclusions.
 */
export const snapshot = (): CanvasBootstrapSnapshot => ({
    session: { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' },
    policy: {
        schemaVersion: 1,
        revision: 'current',
        browser: server.browser === 'firefox' ? CanvasPolicyBrowser.FirefoxMv2 : CanvasPolicyBrowser.ChromiumMv3,
        selectors: { matches: ['<all_urls>'], excludeMatches: [] },
        ownFrameExclusions: [],
        documentExclusions: [],
        unavailableConditions: [],
    },
});

/**
 * Runs a fresh generated bundle in an HTTP document with no extension APIs.
 *
 * @param body Assertions against a genuinely separate realm.
 * @param url Actual native URL of the fresh document.
 */
export const withRealm = async (
    body: (realm: Realm) => Promise<void> | void,
    url = new URL('./empty.html', import.meta.url).href,
): Promise<void> => {
    const frame = document.createElement('iframe');
    frame.width = '64';
    frame.height = '64';
    frame.src = url;
    let watchdog: ReturnType<typeof setTimeout>;
    const loaded = new Promise<void>((resolve, reject) => {
        watchdog = setTimeout(() => {
            reject(new Error(`Iframe load missing: ${frame.contentWindow?.location.href} `
                + `readyState=${frame.contentDocument?.readyState}`));
        }, 3000);
        frame.onload = (): void => { clearTimeout(watchdog); resolve(); };
    });
    document.body.appendChild(frame);
    try {
        await loaded;
        await body(frame.contentWindow as Realm);
    } finally {
        clearTimeout(watchdog!);
        frame.remove();
    }
};

export const WIDTH = 32;
export const HEIGHT = 16;

/**
 * Native methods captured before installation and the realm's site seed.
 */
export interface Installed {
    readonly read: CanvasRenderingContext2D['getImageData'];
    readonly toDataURL: HTMLCanvasElement['toDataURL'];
    readonly toBlob: HTMLCanvasElement['toBlob'];
    readonly seed: Uint8Array;
}

/**
 * Loads the generated engine into a fresh realm, keeping its native readouts for reference.
 *
 * @param realm Fresh document.
 *
 * @returns Native readouts and the expected site seed.
 */
export const install = (realm: Realm): Installed => {
    const state = snapshot();
    const natives = {
        read: realm.CanvasRenderingContext2D.prototype.getImageData,
        toDataURL: realm.HTMLCanvasElement.prototype.toDataURL,
        toBlob: realm.HTMLCanvasElement.prototype.toBlob,
    };
    realm.eval(CanvasProtectionCode.create(state));
    return { ...natives, seed: deriveSiteSeed(state.session, realm.location.hostname) };
};

/**
 * Fills a canvas with varied opaque pixels through `putImageData` only.
 *
 * @param realm Canvas owner realm.
 *
 * @returns Context of a canvas that received no rendering.
 */
export const createFilled = (realm: Realm): CanvasRenderingContext2D => {
    const canvas = realm.document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d')!;
    const image = new realm.ImageData(WIDTH, HEIGHT);
    for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
        image.data.set([(pixel * 13) % 256, (pixel * 47) % 256, (pixel * 101) % 256, 255], pixel * 4);
    }
    context.putImageData(image, 0, 0);
    return context;
};

/**
 * Classifies the installed raw readout against the native one and its expected noise.
 *
 * @param context Canvas context under test.
 * @param installed Native readout and seed.
 *
 * @returns Which bitmap the installed `getImageData` returned.
 */
export const readoutKind = (context: CanvasRenderingContext2D, installed: Installed): 'native' | 'noised' | 'other' => {
    const native: ImageData = Reflect.apply(installed.read, context, [0, 0, WIDTH, HEIGHT]);
    const noised = Array.from(referenceSourceNoise(native, installed.seed));
    expect(noised).not.toEqual(Array.from(native.data));
    const actual = Array.from(context.getImageData(0, 0, WIDTH, HEIGHT).data);
    if (actual.every((value, index) => value === native.data[index])) {
        return 'native';
    }
    return actual.every((value, index) => value === noised[index]) ? 'noised' : 'other';
};
