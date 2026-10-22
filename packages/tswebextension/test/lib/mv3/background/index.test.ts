import { describe, expect, it } from 'vitest';

import { Rule, RuleScanError, UnexpectedConversionError } from '@adguard/dnr-converter';

import {
    UnexpectedConversionError as ReExportedError,
    RuleScanError as ReExportedScanError,
} from '../../../../src/lib/mv3/background';

describe('mv3 background exports', () => {
    it('re-exports UnexpectedConversionError for instanceof checks', () => {
        const [rule] = Rule.createFromText(1, 0, '||example.com^');
        const error = new UnexpectedConversionError('unexpected', rule, new Error('cause'));

        expect(ReExportedError).toBe(UnexpectedConversionError);
        expect(error).toBeInstanceOf(ReExportedError);
    });

    it('re-exports RuleScanError for instanceof checks', () => {
        const error = new RuleScanError('broken', 1, 0);

        expect(ReExportedScanError).toBe(RuleScanError);
        expect(error).toBeInstanceOf(ReExportedScanError);
    });
});
