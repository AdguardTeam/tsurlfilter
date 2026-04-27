import { describe, expect, it } from 'vitest';

import { Engine } from '../../src/engine/engine';

describe('Engine.getRemoveParamUrl', () => {
    it('strips a matching query parameter', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=utm_source',
            }],
        });

        const result = engine.getRemoveParamUrl(
            'https://example.com/page?utm_source=ad&section=news',
            'https://example.com',
        );

        expect(result).toBe('https://example.com/page?section=news');
    });

    it('returns null when no parameters match', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=utm_source',
            }],
        });

        const result = engine.getRemoveParamUrl(
            'https://example.com/page?section=news',
            'https://example.com',
        );

        expect(result).toBeNull();
    });

    it('removes all query parameters with naked $removeparam', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam',
            }],
        });

        const result = engine.getRemoveParamUrl(
            'https://example.com/page?a=1&b=2',
            'https://example.com',
        );

        expect(result).toBe('https://example.com/page');
    });

    it('respects allowlist rules', () => {
        const rules = [
            '||example.com^$removeparam=track',
            '@@||example.com/checkout^$removeparam=track',
        ].join('\n');

        const engine = Engine.createSync({
            filters: [{ id: 1, content: rules }],
        });

        // Allowlisted path — parameter preserved
        expect(engine.getRemoveParamUrl(
            'https://example.com/checkout?track=abc',
            'https://example.com',
        )).toBeNull();

        // Non-allowlisted path — parameter removed
        expect(engine.getRemoveParamUrl(
            'https://example.com/browse?track=abc',
            'https://example.com',
        )).toBe('https://example.com/browse');
    });

    it('handles domain-scoped rules', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '$removeparam=from,domain=vk.com|vk.ru',
            }],
        });

        // Matching domain — parameter removed
        expect(engine.getRemoveParamUrl(
            'https://vk.com/video?from=feed',
            'https://vk.com',
        )).toBe('https://vk.com/video');

        // Non-matching domain — no change
        expect(engine.getRemoveParamUrl(
            'https://other.com/page?from=feed',
            'https://other.com',
        )).toBeNull();
    });

    it('handles regex removeparam patterns', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=/^utm_/',
            }],
        });

        const result = engine.getRemoveParamUrl(
            'https://example.com/p?utm_source=a&utm_medium=b&valid=1',
            'https://example.com',
        );

        expect(result).toBe('https://example.com/p?valid=1');
    });

    it('handles negation removeparam patterns', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=~session',
            }],
        });

        const result = engine.getRemoveParamUrl(
            'https://example.com/p?session=x&track=y&ad=z',
            'https://example.com',
        );

        expect(result).toBe('https://example.com/p?session=x');
    });

    it('applies multiple matching rules', () => {
        const rules = [
            '||vk.com^$removeparam=from',
            '||vk.com^$removeparam=track_code',
        ].join('\n');

        const engine = Engine.createSync({
            filters: [{ id: 1, content: rules }],
        });

        const result = engine.getRemoveParamUrl(
            'https://vk.com/video?from=feed&track_code=abc&title=hello',
            'https://vk.com',
        );

        expect(result).toBe('https://vk.com/video?title=hello');
    });

    it('returns null for URL without query string', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=utm_source',
            }],
        });

        expect(engine.getRemoveParamUrl(
            'https://example.com/page',
            'https://example.com',
        )).toBeNull();
    });

    it('preserves URL fragment', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=p1',
            }],
        });

        const result = engine.getRemoveParamUrl(
            'https://example.com/page?p1=1&p2=2#section',
            'https://example.com',
        );

        expect(result).toBe('https://example.com/page?p2=2#section');
    });

    it('returns null when no removeparam rules are loaded', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^',
            }],
        });

        expect(engine.getRemoveParamUrl(
            'https://example.com/page?utm_source=ad',
            'https://example.com',
        )).toBeNull();
    });

    it('handles allowlist for one param without blocking another', () => {
        const rules = [
            '||example.com^$removeparam=track',
            '||example.com^$removeparam=ref',
            '@@||example.com/checkout^$removeparam=track',
        ].join('\n');

        const engine = Engine.createSync({
            filters: [{ id: 1, content: rules }],
        });

        // On /checkout: track is allowlisted but ref should still be removed
        const result = engine.getRemoveParamUrl(
            'https://example.com/checkout?track=abc&ref=campaign',
            'https://example.com',
        );

        expect(result).toBe('https://example.com/checkout?track=abc');
    });

    it('returns null for invalid or non-http URLs', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: '||example.com^$removeparam=utm_source',
            }],
        });

        // Non-http URL should not throw, returns null
        expect(engine.getRemoveParamUrl(
            'ftp://example.com/page?utm_source=ad',
            'https://example.com',
        )).toBeNull();

        // Relative URL should not throw, returns null
        expect(engine.getRemoveParamUrl(
            '/page?utm_source=ad',
            'https://example.com',
        )).toBeNull();
    });

    it('handles real-world VK filter rules', () => {
        const rules = [
            '$removeparam=list,domain=m.vk.com|vk.com|vk.ru|vkvideo.ru',
            '$removeparam=from,domain=m.vk.com|vk.com|vk.ru|vkvideo.ru',
            '$removeparam=track_code,domain=m.vk.com|vk.com|vk.ru|vkvideo.ru',
            '$removeparam=entrypoint,domain=m.vk.com|vk.com|vk.ru',
        ].join('\n');

        const engine = Engine.createSync({
            filters: [{ id: 1, content: rules }],
        });

        const result = engine.getRemoveParamUrl(
            'https://vk.com/video-230077050_456239246?list=abcd&from=feed&track_code=xyz&entrypoint=menu',
            'https://vk.com',
        );

        expect(result).toBe('https://vk.com/video-230077050_456239246');
    });

    describe('third-party and domain modifier semantics via sourceUrl', () => {
        it('$third-party,removeparam strips param only for cross-origin sourceUrl', () => {
            const engine = Engine.createSync({
                filters: [{
                    id: 1,
                    content: '||example.com^$third-party,removeparam=track',
                }],
            });

            // Cross-origin: sourceUrl (other.com) differs from URL (example.com) → third-party → strips
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&keep=2',
                'https://other.com',
            )).toBe('https://example.com/page?keep=2');

            // Same-origin: sourceUrl (example.com) matches URL (example.com) → first-party → no strip
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&keep=2',
                'https://example.com',
            )).toBeNull();

            // No sourceUrl: thirdParty is null → $third-party check fails → no strip
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&keep=2',
                '',
            )).toBeNull();
        });

        it('$~third-party,removeparam strips param only for same-origin sourceUrl', () => {
            const engine = Engine.createSync({
                filters: [{
                    id: 1,
                    content: '||example.com^$~third-party,removeparam=track',
                }],
            });

            // Same-origin → first-party → strips
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&keep=2',
                'https://example.com',
            )).toBe('https://example.com/page?keep=2');

            // Subdomain of same eTLD+1 → first-party → strips
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&keep=2',
                'https://sub.example.com',
            )).toBe('https://example.com/page?keep=2');

            // Cross-origin → third-party → no strip
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&keep=2',
                'https://other.com',
            )).toBeNull();
        });

        it('$domain restricts removeparam by sourceUrl hostname, not request URL', () => {
            const engine = Engine.createSync({
                filters: [{
                    id: 1,
                    content: '$removeparam=ref,domain=portal.com',
                }],
            });

            // sourceUrl matches $domain — strips param
            expect(engine.getRemoveParamUrl(
                'https://cdn.example.com/page?ref=abc&id=1',
                'https://portal.com',
            )).toBe('https://cdn.example.com/page?id=1');

            // sourceUrl doesn't match $domain — no strip
            expect(engine.getRemoveParamUrl(
                'https://cdn.example.com/page?ref=abc&id=1',
                'https://unrelated.com',
            )).toBeNull();

            // No sourceUrl — domain modifier checks empty string → no strip
            expect(engine.getRemoveParamUrl(
                'https://cdn.example.com/page?ref=abc&id=1',
                '',
            )).toBeNull();
        });

        it('negated $domain with Document request checks both source and target hostname', () => {
            const engine = Engine.createSync({
                filters: [{
                    id: 1,
                    // Wide rule (no URL pattern) so the URL pattern matches any hostname.
                    // Only the domain modifier restricts matching.
                    content: '$removeparam=track,domain=~blocked.com',
                }],
            });

            // getRemoveParamUrl creates a Document-type request.
            // With only excluded domains + Document type, matchDomainModifier
            // checks BOTH sourceHostname and target hostname.

            // sourceUrl is not blocked.com → source matches, so rule applies
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&ok=2',
                'https://allowed.com',
            )).toBe('https://example.com/page?ok=2');

            // sourceUrl IS blocked.com → source is restricted → falls through to
            // target hostname check: example.com is not blocked.com → rule applies
            expect(engine.getRemoveParamUrl(
                'https://example.com/page?track=1&ok=2',
                'https://blocked.com',
            )).toBe('https://example.com/page?ok=2');

            // sourceUrl is blocked.com AND target URL is blocked.com → both restricted → no strip
            expect(engine.getRemoveParamUrl(
                'https://blocked.com/page?track=1&ok=2',
                'https://blocked.com',
            )).toBeNull();
        });

        it('$third-party combined with $domain restricts by both checks', () => {
            const engine = Engine.createSync({
                filters: [{
                    id: 1,
                    content: '$removeparam=utm,domain=news.com|blog.com,third-party',
                }],
            });

            // Cross-origin + sourceUrl matches domain → strips
            expect(engine.getRemoveParamUrl(
                'https://tracker.io/pixel?utm=abc&sid=1',
                'https://news.com',
            )).toBe('https://tracker.io/pixel?sid=1');

            // Cross-origin + sourceUrl matches other permitted domain → strips
            expect(engine.getRemoveParamUrl(
                'https://tracker.io/pixel?utm=abc&sid=1',
                'https://blog.com',
            )).toBe('https://tracker.io/pixel?sid=1');

            // Cross-origin but sourceUrl does NOT match domain → no strip
            expect(engine.getRemoveParamUrl(
                'https://tracker.io/pixel?utm=abc&sid=1',
                'https://other.com',
            )).toBeNull();

            // Same-origin (first-party) even though domain matches → $third-party fails → no strip
            expect(engine.getRemoveParamUrl(
                'https://news.com/page?utm=abc&sid=1',
                'https://news.com',
            )).toBeNull();
        });
    });
});
