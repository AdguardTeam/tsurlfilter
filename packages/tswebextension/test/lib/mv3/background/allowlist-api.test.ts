import { describe, expect, test } from 'vitest';

import { AllowlistApi } from '../../../../src/lib/mv3/background/allowlist-api';

describe('getAllowlistRule', () => {
    test.each([
        {
            input: [],
            expected: '',
        },
        {
            input: ['example.com'],
            expected: '@@$document,important,to=example.com',
        },
        {
            input: ['example.com', 'example.org'],
            expected: '@@$document,important,to=example.com|example.org',
        },
        {
            input: ['example.com', 'example.org', 'example.com'],
            expected: '@@$document,important,to=example.com|example.org',
        },
    ])('$input -> $expected', ({ input, expected }) => {
        const result = AllowlistApi.getAllowlistRule(input);

        expect(result).toBe(expected);
    });
});
