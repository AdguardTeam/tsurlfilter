import { describe, expect, it } from 'vitest';

import { parseDomainList } from '../../src/ast-utils/parsing';

describe('parseDomainList export from package root', () => {
    it('parses a pipe-separated domain list', () => {
        const list = parseDomainList('example.com|~example.org', 0, '|');
        expect(list.type).toBe('DomainList');
        expect(list.separator).toBe('|');
        expect(list.children.map((c) => ({ value: c.value, exception: c.exception }))).toEqual([
            { value: 'example.com', exception: false },
            { value: 'example.org', exception: true },
        ]);
    });
});
