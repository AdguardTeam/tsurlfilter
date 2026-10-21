import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { Engine, Request, RequestType } from '@adguard/tsurlfilter';

import { CanvasExceptionRules } from '../../../../src/lib/common/canvas-protection/exception-rules';
import { ALLOWLIST_FILTER_ID } from '../../../../src/lib/common/constants';

afterEach(() => vi.restoreAllMocks());

describe('canvas exception rule texts', () => {
    it('retrieves active document and stealth texts, skipping generated allowlist rules and missing texts', () => {
        const engine = Engine.createSync({
            filters: [
                { id: ALLOWLIST_FILTER_ID, content: '@@||allowed.org^$document' },
                {
                    id: 1,
                    content: [
                        '@@||stealth.org^$stealth=fingerprinting',
                        '@@||document.org^$document',
                        '@@||cancelled.org^$stealth',
                        '@@||cancelled.org^$stealth,badfilter',
                        '||blocking.org^',
                    ].join('\n'),
                },
            ],
        });
        expect(CanvasExceptionRules.getRuleTexts(engine)).toEqual([
            '@@||stealth.org^$stealth=fingerprinting',
            '@@||document.org^$document',
        ]);
        vi.spyOn(engine, 'retrieveRuleText').mockReturnValueOnce(null);
        expect(CanvasExceptionRules.getRuleTexts(engine)).toEqual(['@@||document.org^$document']);
    });
});

describe('canvas stealth exception of a document', () => {
    it('finds a matching $stealth exception that the policy compiler accepts', () => {
        const engine = Engine.createSync({
            filters: [{
                id: 1,
                content: [
                    '@@||example.org/path$stealth=fingerprinting',
                    '@@||example.org^$stealth=referrer',
                    '@@||sub.example.org^$stealth=referrer|fingerprinting',
                ].join('\n'),
            }],
        });
        const match = (url: string): string | undefined => {
            const rule = CanvasExceptionRules.findStealthException(
                engine.matchRequest(new Request(url, null, RequestType.Document)),
                engine,
            );
            return rule ? engine.retrieveRuleText(rule.getFilterListId(), rule.getIndex()) ?? undefined : undefined;
        };
        expect(match('https://sub.example.org/path')).toBe('@@||sub.example.org^$stealth=referrer|fingerprinting');
        expect(match('https://example.org/path')).toBeUndefined();
        expect(match('https://other.org/')).toBeUndefined();
    });
});
