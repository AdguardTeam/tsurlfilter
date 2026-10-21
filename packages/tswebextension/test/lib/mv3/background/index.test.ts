import { describe, expect, it } from 'vitest';

import { Rule, UnexpectedConversionError } from '@adguard/dnr-converter';

import { UnexpectedConversionError as ReExportedError } from '../../../../src/lib/mv3/background';

describe('mv3 background exports', () => {
    it('re-exports UnexpectedConversionError for instanceof checks', () => {
        const [rule] = Rule.createFromText(1, 0, '||example.com^');
        const error = new UnexpectedConversionError('unexpected', rule, new Error('cause'));

        expect(ReExportedError).toBe(UnexpectedConversionError);
        expect(error).toBeInstanceOf(ReExportedError);
    });
});
