import { describe, expect, it } from 'vitest';

import { FilterList } from '../../src/filterlist/filter-list';

describe('FilterList.prepare output parity', () => {
    it('produces identical converted content for mixed lists', () => {
        const original = [
            '||example.org^',
            'example.com##.ad',
            'example.com#@#.ad',
            'invalid rule syntax',
            '! comment',
            '||track.com^$third-party,domain=a.com|~b.com',
            '', // trailing empty line
        ].join('\n');

        const list = new FilterList(original);
        // Restoring the original must be byte-identical regardless of buffering.
        expect(list.getOriginalContent()).toEqual(original);
    });

    it('keeps CRLF and LF line breaks intact', () => {
        const original = '||a.com^\r\n||b.com^\n||c.com^';
        const list = new FilterList(original);
        expect(list.getOriginalContent()).toEqual(original);
    });
});
