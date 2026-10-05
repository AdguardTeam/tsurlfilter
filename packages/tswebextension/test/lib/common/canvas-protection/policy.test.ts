import { describe, expect, it } from 'vitest';

import {
    CanvasConditionInput,
    CanvasConditionType,
    CanvasPolicyBrowser,
    CanvasPolicyRequestType,
} from '../../../../src/lib/common/canvas-protection/constants';
import {
    type DocumentPolicyInput,
    type PreparedCondition,
    type ProtectionPolicyArtifact,
    protectionPolicyArtifactValidator,
} from '../../../../src/lib/common/canvas-protection/contracts';
import { resolveProtectedSite, resolveSiteKey } from '../../../../src/lib/common/canvas-protection/policy';
import { getDomain } from '../../../../src/lib/common/utils/url';

import { createProtectAllPolicy, preparedPolicyFixtures } from './fixtures/prepared-policies';

/**
 * Creates a policy with the given exclusions.
 *
 * @param exclusions Exclusion lists replacing the empty ones.
 *
 * @returns A prepared policy.
 */
const createPolicy = (
    exclusions: Partial<Pick<ProtectionPolicyArtifact, 'ownFrameExclusions' | 'documentExclusions'>> = {},
): ProtectionPolicyArtifact => ({
    ...createProtectAllPolicy(CanvasPolicyBrowser.ChromiumMv3, 'policy'),
    ...exclusions,
});

/**
 * Describes a top document, which is its own top and source.
 *
 * @param url Document URL.
 *
 * @returns Document input.
 */
const topDocument = (url: string): DocumentPolicyInput => ({
    url, requestType: CanvasPolicyRequestType.Document, topUrl: url, sourceUrl: url,
});

/**
 * Describes a child frame.
 *
 * @param url Frame URL.
 * @param topUrl What the browser reveals about the top document.
 * @param sourceUrl What the browser reveals about the parent document.
 *
 * @returns Frame input.
 */
const childFrame = (url: string, topUrl?: string, sourceUrl = topUrl): DocumentPolicyInput => ({
    url, requestType: CanvasPolicyRequestType.Subdocument, topUrl, sourceUrl,
});

/**
 * Creates a URL predicate.
 *
 * @param input URL the predicate reads.
 * @param pattern Regular expression source.
 *
 * @returns Prepared condition.
 */
const matches = (
    input: Extract<PreparedCondition, { type: CanvasConditionType.UrlRegexp }>['input'],
    pattern: string,
): PreparedCondition => ({
    type: CanvasConditionType.UrlRegexp, input, pattern, flags: '',
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

    it('excludes a document by its own URL', () => {
        const policy = createPolicy({
            ownFrameExclusions: [{
                requestTypes: [CanvasPolicyRequestType.Document, CanvasPolicyRequestType.Subdocument],
                condition: matches(CanvasConditionInput.FrameUrl, '^https://example\\.com/native\\?read=1$'),
            }],
        });
        expect(resolveProtectedSite(policy, topDocument('https://example.com/native?read=1'))).toBeUndefined();
        expect(resolveProtectedSite(policy, topDocument('https://example.com/native?read=2'))).toBe('example.com');
        expect(resolveProtectedSite(policy, childFrame('https://example.com/native?read=1', 'https://top.example/')))
            .toBeUndefined();
    });

    it('applies document exclusions of the top document to its frames', () => {
        const policy = createPolicy({
            documentExclusions: [{
                requestTypes: [CanvasPolicyRequestType.Document],
                condition: matches(CanvasConditionInput.FrameUrl, '^https://top\\.example/'),
            }],
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

    it('evaluates top and source predicates of a child frame', () => {
        const frame = 'https://frame.example/widget';
        const byTop = createPolicy({
            ownFrameExclusions: [{
                requestTypes: [CanvasPolicyRequestType.Subdocument],
                condition: matches(CanvasConditionInput.TopUrl, '^https://top\\.example/'),
            }],
        });
        expect(resolveProtectedSite(byTop, childFrame(frame, 'https://top.example/'))).toBeUndefined();
        expect(resolveProtectedSite(byTop, childFrame(frame, 'https://other.example/'))).toBe('other.example');
        const bySource = createPolicy({
            ownFrameExclusions: [{
                requestTypes: [CanvasPolicyRequestType.Subdocument],
                condition: matches(CanvasConditionInput.SourceUrl, '^https://publisher\\.example/'),
            }],
        });
        expect(resolveProtectedSite(bySource, childFrame(frame, 'https://top.example/', 'https://publisher.example/')))
            .toBeUndefined();
        expect(resolveProtectedSite(bySource, childFrame(frame, 'https://top.example/', 'https://other.example/')))
            .toBe('top.example');
    });

    it('does not exclude on a predicate whose URL is unknown', () => {
        const frame = childFrame('https://frame.example/widget');
        const unknownTop = matches(CanvasConditionInput.TopUrl, '^https://top\\.example/');
        const knownFrame = matches(CanvasConditionInput.FrameUrl, '^https://frame\\.example/');
        const unprepared: PreparedCondition = { type: CanvasConditionType.Unavailable, reason: 'unsupported-rule' };
        const expectations: [PreparedCondition, boolean][] = [
            [unknownTop, false],
            [{ type: CanvasConditionType.Not, operand: unknownTop }, false],
            [{ type: CanvasConditionType.Not, operand: unprepared }, false],
            [{ type: CanvasConditionType.And, operands: [unknownTop, knownFrame] }, false],
            [{ type: CanvasConditionType.Or, operands: [unknownTop, knownFrame] }, true],
            [
                {
                    type: CanvasConditionType.Or,
                    operands: [unprepared, { type: CanvasConditionType.Not, operand: knownFrame }],
                },
                false,
            ],
        ];
        for (const [condition, excluded] of expectations) {
            const policy = createPolicy({
                ownFrameExclusions: [{ requestTypes: [CanvasPolicyRequestType.Subdocument], condition }],
            });
            expect(resolveProtectedSite(policy, frame)).toBe(excluded ? undefined : 'frame.example');
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

    it('validates external prepared artifacts once', () => {
        const policy = createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'external-revision');
        expect(protectionPolicyArtifactValidator.parse(JSON.parse(JSON.stringify(policy)))).toEqual(policy);
        const invalidInputs = [
            { ...policy, schemaVersion: 2 },
            { ...policy, browser: 'unknown' },
            { ...policy, revision: 42 },
            { ...policy, selectors: { matches: 'all', excludeMatches: [] } },
            { ...policy, extra: 'unrecognized' },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: ['script'],
                    condition: {
                        type: CanvasConditionType.Unavailable, reason: 'no-source',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: [CanvasPolicyRequestType.Document],
                    condition: {
                        type: CanvasConditionType.UrlRegexp,
                        input: CanvasConditionInput.FrameUrl,
                        pattern: '[',
                        flags: '',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: [CanvasPolicyRequestType.Document],
                    condition: {
                        type: CanvasConditionType.UrlRegexp,
                        input: CanvasConditionInput.FrameUrl,
                        pattern: '.',
                        flags: 'g',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: [CanvasPolicyRequestType.Document],
                    condition: {
                        type: CanvasConditionType.UrlRegexp, input: 'referrer', pattern: '.', flags: '',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: [CanvasPolicyRequestType.Document],
                    condition: {
                        type: CanvasConditionType.Not, operand: { type: CanvasConditionType.Unavailable },
                    },
                }],
            },
            // Rules that could never match.
            {
                ...policy,
                ownFrameExclusions: [{ requestTypes: [], condition: matches(CanvasConditionInput.FrameUrl, '.') }],
            },
            {
                ...policy,
                documentExclusions: [{
                    requestTypes: [CanvasPolicyRequestType.Subdocument],
                    condition: matches(CanvasConditionInput.FrameUrl, '.'),
                }],
            },
        ];
        for (const value of invalidInputs) {
            expect(protectionPolicyArtifactValidator.safeParse(value).success).toBe(false);
        }
    });

    it.each(preparedPolicyFixtures)('evaluates exact prepared fixture: $name', (fixture) => {
        const policy = protectionPolicyArtifactValidator.parse(createPolicy({ ownFrameExclusions: [fixture.rule] }));
        const input = fixture.requestType === CanvasPolicyRequestType.Subdocument
            ? childFrame(fixture.url, undefined, fixture.sourceUrl) : topDocument(fixture.url);
        expect(resolveProtectedSite(policy, input) === undefined).toBe(fixture.excluded);
    });
});
