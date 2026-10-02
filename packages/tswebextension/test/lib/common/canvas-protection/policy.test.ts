import { describe, expect, it } from 'vitest';

import {
    type CanvasBootstrapSnapshot,
    type CanvasFeatureGates,
    type DocumentPolicyInput,
    type InheritedTopContext,
    type PreparedCondition,
    protectionPolicyArtifactValidator,
} from '../../../../src/lib/common/canvas-protection/contracts';
import { resolveDocumentProtection, resolveSiteIdentity } from '../../../../src/lib/common/canvas-protection/policy';
import { getDomain } from '../../../../src/lib/common/utils/url';

import { createProtectAllPolicy, preparedPolicyFixtures } from './fixtures/prepared-policies';

const allGates: CanvasFeatureGates = {
    filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true,
};

/**
 * Creates an independent document's captured bootstrap state.
 *
 * @returns A current policy and session snapshot.
 */
const createSnapshot = (): CanvasBootstrapSnapshot => ({
    session: { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' },
    gates: { ...allGates },
    policy: createProtectAllPolicy('chromium-mv3', 'child-policy'),
});

/**
 * Creates available captured top context for inherited exception tests.
 *
 * @param documentExcluded Whether the top document is excluded by a document rule.
 * @param allowlistExcluded Whether the top document is excluded by allowlisting.
 *
 * @returns Captured top context with independent revision and generation.
 */
const createTop = (documentExcluded = false, allowlistExcluded = false): InheritedTopContext => ({
    documentExcluded: { status: 'available', value: documentExcluded },
    allowlistExcluded: { status: 'available', value: allowlistExcluded },
    site: resolveSiteIdentity('https://top.example/', 'top-derived'),
    policyRevision: { status: 'available', value: 'top-policy' },
    capturedGeneration: { status: 'available', value: '11111111111111111111111111111111' },
});

/**
 * Creates document input without claiming a trustworthy request source.
 *
 * @param url Current document URL.
 * @param requestType Top document or child frame applicability.
 *
 * @returns Synchronous document input.
 */
const createInput = (
    url = 'https://frame.example/',
    requestType: DocumentPolicyInput['requestType'] = 'document',
): DocumentPolicyInput => ({
    url,
    requestType,
    inheritedTop: { status: 'unavailable', reason: 'trusted-top-context-unavailable' },
    sourceUrl: { status: 'unavailable', reason: 'request-source-unavailable' },
});

describe('canvas protection policy', () => {
    it('captures all three gates before hooks', () => {
        const snapshot = createSnapshot();
        const enabled = resolveDocumentProtection(snapshot, createInput());
        expect(enabled.outcome).toBe('enabled');
        for (const gate of Object.keys(allGates) as (keyof CanvasFeatureGates)[]) {
            const gates = { ...allGates, [gate]: false };
            const context = resolveDocumentProtection({ ...snapshot, gates }, createInput());
            expect(context.enabled).toBe(false);
            expect(context.outcome).toBe('disabled');
            expect(context.gates).toEqual(gates);
        }
        expect(Object.isFrozen(enabled)).toBe(true);
        expect(Object.isFrozen(enabled.gates)).toBe(true);
        expect(Object.isFrozen(enabled.site)).toBe(true);
        (snapshot.gates as { protectCanvas: boolean }).protectCanvas = false;
        expect(enabled.gates.protectCanvas).toBe(true);
    });

    it('keeps path and query exclusions local', () => {
        const snapshot = createSnapshot();
        const policy = {
            ...snapshot.policy,
            ownFrameExclusions: [{
                requestTypes: ['document', 'subdocument'] as const,
                condition: {
                    type: 'url-regexp' as const,
                    input: 'frame-url' as const,
                    pattern: '^https://example\\.com/native\\?read=1$',
                    flags: '' as const,
                },
            }],
        };
        const excluded = resolveDocumentProtection({ ...snapshot, policy }, createInput('https://example.com/native?read=1'));
        const enabled = resolveDocumentProtection({ ...snapshot, policy }, createInput('https://example.com/native?read=2'));
        expect(excluded.outcome).toBe('excluded');
        expect(enabled.outcome).toBe('enabled');
        expect(excluded.site).toMatchObject({ status: 'available', value: { key: 'example.com' } });
        expect(enabled.site).toMatchObject({ status: 'available', value: { key: 'example.com' } });
    });

    it.each([
        { topUrl: 'https://top.example/native?read=1', frameUrl: 'https://top.example/protected?read=2', excluded: true },
        { topUrl: 'https://top.example/native?read=2', frameUrl: 'https://top.example/native?read=1', excluded: false },
        { topUrl: 'https://top.example/protected?read=1', frameUrl: 'https://top.example/native?read=1', excluded: false },
    ])('uses the captured top URL for child predicates: $topUrl', ({ topUrl, frameUrl, excluded }) => {
        const snapshot = createSnapshot();
        const top = { ...createTop(), site: resolveSiteIdentity(topUrl, 'top-derived') };
        const context = resolveDocumentProtection({
            ...snapshot,
            policy: {
                ...snapshot.policy,
                ownFrameExclusions: [{
                    requestTypes: ['subdocument'],
                    condition: {
                        type: 'url-regexp',
                        input: 'top-url',
                        pattern: '^https://top\\.example/native\\?read=1$',
                        flags: '',
                    },
                }],
            },
        }, {
            ...createInput(frameUrl, 'subdocument'),
            inheritedTop: { status: 'available', value: top },
        });
        expect(context.outcome).toBe(excluded ? 'excluded' : 'enabled');
        expect(context.excluded).toBe(excluded);
        expect(context.provenance.ownFrameExclusion).toEqual({ status: 'available', value: excluded });
        expect(context.provenance.documentExclusion).toEqual({ status: 'available', value: false });
        expect(context.provenance.frameUrl).toBe(frameUrl);
        expect(context.provenance.inheritedTop).toEqual({ status: 'available', value: top });
        expect(context.site).toEqual(resolveSiteIdentity(topUrl, 'top-derived'));
        expect(context.unavailableConditions).toEqual([]);
    });

    it.each([
        { url: 'https://top.example/native?read=1', inheritedUrl: 'https://top.example/protected?read=2', excluded: true },
        { url: 'https://top.example/native?read=2', inheritedUrl: 'https://top.example/native?read=1', excluded: false },
        { url: 'https://top.example/protected?read=1', inheritedUrl: 'https://top.example/native?read=1', excluded: false },
    ])('uses the top document own URL for top predicates: $url', ({ url, inheritedUrl, excluded }) => {
        const snapshot = createSnapshot();
        const context = resolveDocumentProtection({
            ...snapshot,
            policy: {
                ...snapshot.policy,
                documentExclusions: [{
                    requestTypes: ['document'],
                    condition: {
                        type: 'url-regexp',
                        input: 'top-url',
                        pattern: '^https://top\\.example/native\\?read=1$',
                        flags: '',
                    },
                }],
            },
        }, {
            ...createInput(url),
            inheritedTop: {
                status: 'available',
                value: { ...createTop(), site: resolveSiteIdentity(inheritedUrl, 'top-derived') },
            },
        });
        expect(context.outcome).toBe(excluded ? 'excluded' : 'enabled');
        expect(context.excluded).toBe(excluded);
        expect(context.provenance.ownFrameExclusion).toEqual({ status: 'available', value: false });
        expect(context.provenance.documentExclusion).toEqual({ status: 'available', value: excluded });
        expect(context.site).toEqual(resolveSiteIdentity(url, 'top-derived'));
        expect(context.unavailableConditions).toEqual([]);
    });

    it.each([
        { availableTop: false, inverted: false },
        { availableTop: false, inverted: true },
        { availableTop: true, inverted: false },
        { availableTop: true, inverted: true },
    ])('keeps unavailable top URL predicates unknown: $availableTop/$inverted', ({ availableTop, inverted }) => {
        const snapshot = createSnapshot();
        const url = 'https://top.example/native?read=1';
        const reason = availableTop ? 'top-site-unavailable' : 'trusted-top-context-unavailable';
        const topCondition: PreparedCondition = {
            type: 'url-regexp', input: 'top-url', pattern: '^https://top\\.example/native\\?read=1$', flags: '',
        };
        const inheritedTop: DocumentPolicyInput['inheritedTop'] = availableTop ? {
            status: 'available',
            value: { ...createTop(), site: { status: 'unavailable', reason } },
        } : { status: 'unavailable', reason };
        const context = resolveDocumentProtection({
            ...snapshot,
            policy: {
                ...snapshot.policy,
                ownFrameExclusions: [{
                    requestTypes: ['subdocument'],
                    condition: inverted ? { type: 'not', operand: topCondition } : topCondition,
                }],
            },
        }, {
            ...createInput(url, 'subdocument'),
            inheritedTop,
            sourceUrl: { status: 'available', value: url },
        });
        expect(context.outcome).toBe('enabled');
        expect(context.excluded).toBe(false);
        expect(context.site).toEqual(resolveSiteIdentity(url, 'frame-local'));
        expect(context.provenance.ownFrameExclusion).toEqual({ status: 'unavailable', reason });
        expect(context.provenance.inheritedTop).toEqual(inheritedTop);
        expect(context.provenance.documentExclusion).toEqual(availableTop
            ? { status: 'available', value: false } : { status: 'unavailable', reason });
        expect(context.unavailableConditions).toEqual([reason]);
    });

    it.each([
        { url: 'https://frame.example/native?read=1', excluded: true },
        { url: 'https://frame.example/native?read=2', excluded: false },
    ])('preserves local decisions alongside unavailable top URL coverage: $url', ({ url, excluded }) => {
        const snapshot = createSnapshot();
        const context = resolveDocumentProtection({
            ...snapshot,
            policy: {
                ...snapshot.policy,
                ownFrameExclusions: [{
                    requestTypes: ['subdocument'],
                    condition: {
                        type: 'url-regexp',
                        input: 'top-url',
                        pattern: '^https://top\\.example/native\\?read=1$',
                        flags: '',
                    },
                }, {
                    requestTypes: ['subdocument'],
                    condition: {
                        type: 'url-regexp',
                        input: 'frame-url',
                        pattern: '^https://frame\\.example/native\\?read=1$',
                        flags: '',
                    },
                }],
            },
        }, createInput(url, 'subdocument'));
        expect(context.outcome).toBe(excluded ? 'excluded' : 'enabled');
        expect(context.excluded).toBe(excluded);
        expect(context.site).toEqual(resolveSiteIdentity(url, 'frame-local'));
        expect(context.provenance.ownFrameExclusion).toEqual(excluded
            ? { status: 'available', value: true }
            : { status: 'unavailable', reason: 'trusted-top-context-unavailable' });
        expect(context.provenance.documentExclusion).toEqual({
            status: 'unavailable', reason: 'trusted-top-context-unavailable',
        });
        expect(context.unavailableConditions).toEqual(['trusted-top-context-unavailable']);
    });

    it('separates frame exclusions from inherited document exclusions', () => {
        const snapshot = createSnapshot();
        const input = createInput('https://frame.example/', 'subdocument');
        for (const top of [createTop(true, false), createTop(false, true)]) {
            const context = resolveDocumentProtection(snapshot, {
                ...input, inheritedTop: { status: 'available', value: top },
            });
            expect(context.outcome).toBe('excluded');
            expect(context.policyRevision).toBe('child-policy');
            expect(context.capturedGeneration).toBe(snapshot.session.generation);
            expect(context.provenance.inheritedTop).toEqual({ status: 'available', value: top });
            expect(context.site).toEqual(top.site);
        }
        const ownCondition: PreparedCondition = {
            type: 'url-regexp', input: 'frame-url', pattern: '^https://frame\\.example/native$', flags: '',
        };
        const topCondition: PreparedCondition = {
            type: 'url-regexp', input: 'frame-url', pattern: '^https://top\\.example/', flags: '',
        };
        const ownExcluded = resolveDocumentProtection({
            ...snapshot,
            policy: {
                ...snapshot.policy,
                ownFrameExclusions: [{
                    requestTypes: ['subdocument'], condition: ownCondition,
                }],
                documentExclusions: [{ requestTypes: ['document'], condition: topCondition }],
            },
        }, {
            ...input,
            url: 'https://frame.example/native',
            inheritedTop: { status: 'available', value: createTop() },
        });
        expect(ownExcluded.excluded).toBe(true);
        expect(ownExcluded.provenance.ownFrameExclusion).toEqual({ status: 'available', value: true });
        expect(ownExcluded.provenance.documentExclusion).toEqual({ status: 'available', value: false });

        for (const inverted of [false, true]) {
            const condition: PreparedCondition = inverted
                ? { type: 'not', operand: topCondition } : topCondition;
            const policy = {
                ...snapshot.policy,
                documentExclusions: [{
                    requestTypes: ['document'] as const, condition,
                }],
            };
            expect(resolveDocumentProtection({ ...snapshot, policy }, createInput('https://top.example/')).excluded)
                .toBe(!inverted);
            expect(resolveDocumentProtection({ ...snapshot, policy }, createInput('https://other.example/')).excluded)
                .toBe(inverted);
        }
    });

    it('protects eligible frame with unavailable inherited conditions', () => {
        const snapshot = createSnapshot();
        const input = createInput('https://frame.example/', 'subdocument');
        const unknown: PreparedCondition = { type: 'unavailable', reason: 'unsupported-origin-fallback' };
        const source: PreparedCondition = {
            type: 'url-regexp', input: 'source-url', pattern: '^https://publisher\\.example/', flags: '',
        };
        const policy = {
            ...snapshot.policy,
            unavailableConditions: ['unsupported-selector'],
            ownFrameExclusions: [{
                requestTypes: ['subdocument'] as const,
                condition: {
                    type: 'or' as const,
                    operands: [unknown, source],
                },
            }],
        };
        const context = resolveDocumentProtection({ ...snapshot, policy }, input);
        expect(context.outcome).toBe('enabled');
        expect(context.site).toEqual(resolveSiteIdentity(input.url, 'frame-local'));
        expect(context.provenance.ownFrameExclusion.status).toBe('unavailable');
        expect(context.provenance.documentExclusion.status).toBe('unavailable');
        expect(context.unavailableConditions).toEqual(expect.arrayContaining([
            'unsupported-selector', 'unsupported-origin-fallback', 'request-source-unavailable',
            'trusted-top-context-unavailable',
        ]));
        const knownSource = resolveDocumentProtection({ ...snapshot, policy }, {
            ...input,
            sourceUrl: { status: 'available', value: 'https://publisher.example/article' },
        });
        expect(knownSource.outcome).toBe('excluded');

        const partialTop = {
            ...createTop(),
            allowlistExcluded: { status: 'unavailable' as const, reason: 'allowlist-context-unavailable' },
            policyRevision: { status: 'unavailable' as const, reason: 'top-revision-unavailable' },
        };
        const partialContext = resolveDocumentProtection(snapshot, {
            ...input, inheritedTop: { status: 'available', value: partialTop },
        });
        expect(partialContext.site).toEqual(resolveSiteIdentity(input.url, 'frame-local'));
        expect(partialContext.unavailableConditions).toContain('top-revision-unavailable');
        Object.assign(partialTop, { allowlistExcluded: { status: 'available', value: true } });
        expect(partialContext.enabled).toBe(true);
        expect(partialContext.provenance.inheritedTop).toMatchObject({
            status: 'available',
            value: {
                allowlistExcluded: { status: 'unavailable', reason: 'allowlist-context-unavailable' },
            },
        });

        const unavailableSite = {
            ...createTop(true),
            site: {
                status: 'unavailable' as const,
                reason: 'top-site-unavailable',
            },
        };
        const excluded = resolveDocumentProtection(snapshot, {
            ...input, inheritedTop: { status: 'available', value: unavailableSite },
        });
        expect(excluded.outcome).toBe('excluded');
        expect(excluded.site).toEqual(resolveSiteIdentity(input.url, 'frame-local'));

        for (const type of ['and', 'or'] as const) {
            const condition: PreparedCondition = {
                type,
                operands: [unknown, {
                    type: 'url-regexp', input: 'frame-url', pattern: '^https://frame\\.example/', flags: '',
                }],
            };
            const result = resolveDocumentProtection({
                ...snapshot,
                policy: {
                    ...snapshot.policy,
                    ownFrameExclusions: [{ requestTypes: ['subdocument'], condition }],
                },
            }, input);
            expect(result.excluded).toBe(type === 'or');
            expect(result.provenance.ownFrameExclusion.status).toBe(type === 'or' ? 'available' : 'unavailable');
            expect(result.unavailableConditions).toContain('unsupported-origin-fallback');
        }
        const negatedUnknown = resolveDocumentProtection(
            {
                ...snapshot,
                policy: {
                    ...snapshot.policy,
                    ownFrameExclusions: [{
                        requestTypes: ['subdocument'],
                        condition: { type: 'not', operand: unknown },
                    }],
                },
            },
            input,
        );
        expect(negatedUnknown.enabled).toBe(true);
        expect(negatedUnknown.provenance.ownFrameExclusion.status).toBe('unavailable');
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
            ['http://127.0.0.1:8080/', '127.0.0.1'],
            ['http://[2001:db8::1]:8080/', '[2001:db8::1]'],
            ['https://user:password@www.example.com.:8443/', 'example.com'],
            ['http://user:password@[2001:db8::2]:8080/', '[2001:db8::2]'],
        ];
        for (const [url, key] of pairs) {
            expect(resolveSiteIdentity(url, 'frame-local')).toEqual({
                status: 'available',
                value: {
                    key, mode: 'frame-local', sourceUrl: url,
                },
            });
        }
        for (const url of ['https://www.example.com.:8443/path', 'https://a.github.io/']) {
            expect(resolveSiteIdentity(url, 'top-derived')).toMatchObject({ value: { key: getDomain(url) } });
        }
        expect(resolveSiteIdentity('https://bücher.example/', 'top-derived'))
            .toMatchObject({ value: { key: 'xn--bcher-kva.example' } });
        for (const url of ['about:blank', 'data:text/html,hello', 'file:///tmp/page.html', 'invalid']) {
            const site = resolveSiteIdentity(url, 'frame-local');
            expect(site.status).toBe('unavailable');
            expect(site).toHaveProperty('reason', expect.any(String));
            const context = resolveDocumentProtection(createSnapshot(), createInput(url, 'subdocument'));
            expect(context.outcome).toBe('unsupported');
            expect(context.enabled).toBe(false);
        }
    });

    it('validates external prepared artifacts once', () => {
        const policy = createProtectAllPolicy('firefox-mv2', 'external-revision');
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
                        type: 'unavailable', reason: 'no-source',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: ['document'],
                    condition: {
                        type: 'url-regexp', input: 'frame-url', pattern: '[', flags: '',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: ['document'],
                    condition: {
                        type: 'url-regexp', input: 'frame-url', pattern: '.', flags: 'g',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: ['document'],
                    condition: {
                        type: 'url-regexp', input: 'referrer', pattern: '.', flags: '',
                    },
                }],
            },
            {
                ...policy,
                ownFrameExclusions: [{
                    requestTypes: ['document'],
                    condition: {
                        type: 'not', operand: { type: 'unavailable' },
                    },
                }],
            },
        ];
        for (const value of invalidInputs) {
            expect(protectionPolicyArtifactValidator.safeParse(value).success).toBe(false);
        }
    });

    it.each(preparedPolicyFixtures)('evaluates exact prepared fixture: $name', (fixture) => {
        const snapshot = createSnapshot();
        const policy = protectionPolicyArtifactValidator.parse({
            ...snapshot.policy, ownFrameExclusions: [fixture.rule],
        });
        const input = {
            ...createInput(fixture.url, fixture.requestType),
            ...(fixture.sourceUrl ? { sourceUrl: fixture.sourceUrl } : {}),
        };
        const context = resolveDocumentProtection({ ...snapshot, policy }, input);
        expect(context.excluded).toBe(fixture.excluded);
        expect(context.enabled).toBe(!fixture.excluded);
        if (fixture.unavailableReason) {
            expect(context.unavailableConditions).toContain(fixture.unavailableReason);
            expect(context.provenance.ownFrameExclusion.status).toBe('unavailable');
        }
    });
});
