import { describe, expect, it } from 'vitest';

import { CanvasConditionType } from '../../../../src/lib/common/canvas-protection/constants';
import {
    type DocumentPolicyInput,
    type PreparedCondition,
    type ProtectionPolicyArtifact,
} from '../../../../src/lib/common/canvas-protection/contracts';
import { resolveProtectedSite, resolveSiteKey } from '../../../../src/lib/common/canvas-protection/policy';
import { getDomain } from '../../../../src/lib/common/utils/url';

import { createProtectAllPolicy, hostCondition, preparedPolicyFixtures } from './fixtures/prepared-policies';

/**
 * Creates a policy with the given exclusions.
 *
 * @param exclusions Exclusion lists replacing the empty ones.
 *
 * @returns A prepared policy.
 */
const createPolicy = (
    exclusions: Partial<Pick<ProtectionPolicyArtifact, 'documentExclusions'>> = {},
): ProtectionPolicyArtifact => ({
    ...createProtectAllPolicy('policy'),
    ...exclusions,
});

/**
 * Describes a top document, which is its own top.
 *
 * @param url Document URL.
 *
 * @returns Document input.
 */
const topDocument = (url: string): DocumentPolicyInput => ({
    url, topUrl: url,
});

/**
 * Describes a child frame.
 *
 * @param url Frame URL.
 * @param topUrl What the browser reveals about the top document.
 *
 * @returns Frame input.
 */
const childFrame = (url: string, topUrl?: string): DocumentPolicyInput => ({
    url, topUrl,
});

describe('canvas protection policy', () => {
    it('keys a top document by its own hostname', () => {
        expect(resolveProtectedSite(createPolicy(), topDocument('https://www.example.com/page'))).toBe('example.com');
    });

    it('keys a child frame by its top document, so one tracker gets a different noise on every site', () => {
        const tracker = 'https://tracker.example/pixel';
        expect(resolveProtectedSite(createPolicy(), childFrame(tracker, 'https://news.example/article')))
            .toBe('news.example');
        // A cross-origin top document reveals only its origin.
        expect(resolveProtectedSite(createPolicy(), childFrame(tracker, 'https://shop.example/')))
            .toBe('shop.example');
    });

    it('falls back to the frame hostname when the top document is unknown or has no hostname', () => {
        const tracker = 'https://tracker.example/pixel';
        expect(resolveProtectedSite(createPolicy(), childFrame(tracker))).toBe('tracker.example');
        expect(resolveProtectedSite(createPolicy(), childFrame(tracker, 'about:blank'))).toBe('tracker.example');
    });

    it('applies document exclusions of the top document to its frames', () => {
        const policy = createPolicy({
            documentExclusions: [hostCondition({ hosts: ['top.example'] })],
        });
        const frame = 'https://frame.example/widget';
        expect(resolveProtectedSite(policy, topDocument('https://top.example/page'))).toBeUndefined();
        expect(resolveProtectedSite(policy, childFrame(frame, 'https://top.example/page'))).toBeUndefined();
        expect(resolveProtectedSite(policy, childFrame(frame, 'https://top.example/'))).toBeUndefined();
        expect(resolveProtectedSite(policy, childFrame(frame, 'https://other.example/'))).toBe('other.example');
        // The frame URL itself is not what a document exclusion reads.
        expect(resolveProtectedSite(policy, childFrame('https://top.example/widget', 'https://other.example/')))
            .toBe('other.example');
        // An unknown top document is not excluded.
        expect(resolveProtectedSite(policy, childFrame(frame))).toBe('frame.example');
    });

    it('preserves three-state logic when the top URL is unknown', () => {
        const unknownTop = hostCondition({ hosts: ['top.example'] });
        const expectations: [PreparedCondition, boolean][] = [
            [unknownTop, false],
            [{ type: CanvasConditionType.Not, operand: unknownTop }, false],
        ];
        for (const [condition, excluded] of expectations) {
            const policy = createPolicy({ documentExclusions: [condition] });
            expect(resolveProtectedSite(policy, childFrame('https://frame.example/widget')))
                .toBe(excluded ? undefined : 'frame.example');
        }
    });

    it('preserves complete hostname semantics', () => {
        const pairs = [
            ['https://www.example.com.:8443/path', 'example.com'],
            ['http://example.com:8080/', 'example.com'],
            ['https://www.www.example.com/', 'www.example.com'],
            ['https://a.example.com/', 'a.example.com'],
            ['https://b.example.com/', 'b.example.com'],
            ['https://a.github.io/', 'a.github.io'],
            ['https://b.github.io/', 'b.github.io'],
            ['https://xn--bcher-kva.example/', 'xn--bcher-kva.example'],
            ['https://bücher.example/', 'xn--bcher-kva.example'],
            ['http://127.0.0.1:8080/', '127.0.0.1'],
            ['http://[2001:db8::1]:8080/', '[2001:db8::1]'],
            ['https://user:password@www.example.com.:8443/', 'example.com'],
            ['http://user:password@[2001:db8::2]:8080/', '[2001:db8::2]'],
        ];
        for (const [url, key] of pairs) {
            expect(resolveSiteKey(url)).toBe(key);
        }
        for (const url of ['https://www.example.com.:8443/path', 'https://a.github.io/']) {
            expect(resolveSiteKey(url)).toBe(getDomain(url));
        }
        for (const url of ['about:blank', 'data:text/html,hello', 'file:///tmp/page.html', 'invalid']) {
            expect(resolveSiteKey(url)).toBeUndefined();
            expect(resolveProtectedSite(createPolicy(), topDocument(url))).toBeUndefined();
            expect(resolveProtectedSite(createPolicy(), childFrame(url))).toBeUndefined();
        }
    });

    it.each(['about:blank', 'data:text/html,top', 'file:///tmp/page.html'])(
        'never excludes a top document without a hostname: %s',
        (topUrl) => {
            const policy = createPolicy({
                documentExclusions: [{ type: CanvasConditionType.Not, operand: hostCondition({}) }],
            });
            expect(resolveProtectedSite(policy, childFrame('https://frame.example/widget', topUrl)))
                .toBe('frame.example');
            expect(resolveProtectedSite(policy, childFrame('https://frame.example/widget', 'https://top.example/')))
                .toBeUndefined();
        },
    );

    it.each(preparedPolicyFixtures)('evaluates exact prepared fixture: $name', (fixture) => {
        const policy = createPolicy({ documentExclusions: [fixture.condition] });
        expect(resolveProtectedSite(policy, topDocument(fixture.url)) === undefined).toBe(fixture.excluded);
        expect(resolveProtectedSite(policy, childFrame('https://frame.example/', fixture.url)) === undefined)
            .toBe(fixture.excluded);
    });
});
