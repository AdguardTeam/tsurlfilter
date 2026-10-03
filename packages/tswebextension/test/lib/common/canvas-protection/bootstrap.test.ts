import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    bootstrapCanvasProtection,
    readDocumentPolicyInput,
} from '../../../../src/lib/common/canvas-protection/bootstrap';
import { type CanvasBootstrapSnapshot } from '../../../../src/lib/common/canvas-protection/contracts';
import { deriveInstallationTokens } from '../../../../src/lib/common/canvas-protection/noise';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

/**
 * Creates trusted registration state.
 *
 * @param policy Prepared exclusions.
 *
 * @returns A current snapshot.
 */
const snapshot = (policy = createProtectAllPolicy('chromium-mv3', 'current')): CanvasBootstrapSnapshot => ({
    session: { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' },
    policy,
});

/**
 * Describes a child frame's window as a browser exposes it.
 *
 * @param href Frame URL.
 * @param ancestors Ancestor windows from the parent up, each with a URL or `null` when cross-origin.
 * @param ancestorOrigins Origins the browser lists for those ancestors, when it lists them.
 *
 * @returns The frame's window.
 */
const frameWindow = (
    href: string,
    ancestors: (string | null)[],
    ancestorOrigins?: string[],
): Window => {
    const windows = ancestors.map((url) => ({
        get location(): { href: string } {
            if (url === null) {
                throw new DOMException('Blocked a frame from accessing a cross-origin frame.', 'SecurityError');
            }
            return { href: url };
        },
    }));
    return {
        location: { href, ancestorOrigins },
        parent: windows[0],
        top: windows[windows.length - 1],
    } as unknown as Window;
};

describe('document canvas bootstrap', () => {
    it('describes a top document as its own top and source', () => {
        expect(readDocumentPolicyInput(window)).toEqual({
            url: window.location.href,
            requestType: 'document',
            topUrl: window.location.href,
            sourceUrl: window.location.href,
        });
    });

    it('reads the complete URL of same-origin ancestors', () => {
        expect(readDocumentPolicyInput(frameWindow(
            'https://site.example/frame',
            ['https://site.example/parent', 'https://site.example/top'],
            ['https://site.example', 'https://site.example'],
        ))).toEqual({
            url: 'https://site.example/frame',
            requestType: 'subdocument',
            topUrl: 'https://site.example/top',
            sourceUrl: 'https://site.example/parent',
        });
    });

    it('reads the listed origin of cross-origin ancestors', () => {
        expect(readDocumentPolicyInput(frameWindow(
            'https://tracker.example/pixel',
            [null, null],
            ['https://widget.example', 'https://news.example'],
        ))).toMatchObject({ topUrl: 'https://news.example/', sourceUrl: 'https://widget.example/' });
        expect(readDocumentPolicyInput(frameWindow('https://tracker.example/pixel', [null], ['https://news.example'])))
            .toMatchObject({ topUrl: 'https://news.example/', sourceUrl: 'https://news.example/' });
    });

    it('leaves a cross-origin ancestor unknown when the browser lists no origin for it', () => {
        const unknown = { requestType: 'subdocument', topUrl: undefined, sourceUrl: undefined };
        // Firefox before 148 has no list; an opaque or hidden origin is listed as "null".
        expect(readDocumentPolicyInput(frameWindow('https://tracker.example/pixel', [null]))).toMatchObject(unknown);
        expect(readDocumentPolicyInput(frameWindow('https://tracker.example/pixel', [null], ['null'])))
            .toMatchObject(unknown);
    });

    it('reads no page-defined marker', () => {
        let calls = 0;
        Object.defineProperty(window, 'adguardCanvasContext', {
            configurable: true,
            get: (): never => { calls += 1; throw new Error('page marker must remain unread'); },
        });
        try {
            expect(readDocumentPolicyInput(window).requestType).toBe('document');
            expect(calls).toBe(0);
        } finally {
            Reflect.deleteProperty(window, 'adguardCanvasContext');
        }
    });

    it('leaves an excluded document and its global object untouched', () => {
        vi.stubGlobal('CanvasRenderingContext2D', { prototype: { getImageData: (): void => {} } });
        const before = HTMLCanvasElement.prototype.toDataURL;
        const { toString } = Function.prototype;
        const globals = Reflect.ownKeys(window);
        const excluded = snapshot({
            ...createProtectAllPolicy('chromium-mv3', 'current'),
            ownFrameExclusions: [{
                requestTypes: ['document'],
                condition: {
                    type: 'url-regexp', input: 'frame-url', pattern: '.', flags: '',
                },
            }],
        });
        bootstrapCanvasProtection(excluded, deriveInstallationTokens(excluded.session));
        expect(HTMLCanvasElement.prototype.toDataURL).toBe(before);
        expect(Function.prototype.toString).toBe(toString);
        expect(Reflect.ownKeys(window)).toEqual(globals);
    });
});
