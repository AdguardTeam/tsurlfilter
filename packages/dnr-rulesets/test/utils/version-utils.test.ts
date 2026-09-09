import {
    describe,
    expect,
    it,
    test,
    vitest,
} from 'vitest';

import packageJson from '../../package.json';
import { generatePatchVersion, generateTimestampFromVersion, getVersion } from '../../src/utils/version-utils';

describe('Utils tests', () => {
    describe('getVersion', () => {
        it('returns an injected version or explains how to inject one', () => {
            if ('version' in packageJson && typeof packageJson.version === 'string') {
                expect(getVersion()).toBe(packageJson.version);
                return;
            }

            expect(getVersion).toThrow('Run scripts/inject-package-versions.mjs before building.');
        });
    });

    describe('generatePatchVersion', () => {
        test.each([
            {
                input: 1739560493923,
                expected: '20250214191453',
            },
            {
                input: 1739511493935,
                expected: '20250214053813',
            },
            {
                input: 1739560443945,
                expected: '20250214191403',
            },
        ])('should generate patch version for $input', ({ input, expected }) => {
            expect(generatePatchVersion(input)).toBe(expected);
        });
    });

    describe('generateTimestampFromVersion', () => {
        it('generateTimestampFromVersion - patch version is not generated previously', () => {
            const testTimestamp = 12345;
            vitest.spyOn(Date, 'now').mockReturnValue(testTimestamp);

            expect(generateTimestampFromVersion('2.1.0')).toBe(testTimestamp);
        });

        describe('generateTimestampFromVersion - generated patch version', () => {
            test.each([
                {
                    input: '1.2.20250215191524',
                    expected: 1739646924000,
                },
                {
                    input: '2.0.20250310021655',
                    expected: 1741573015000,
                },
            ])('should generate timestamp from version $input', ({ input, expected }) => {
                expect(generateTimestampFromVersion(input)).toBe(expected);
            });
        });
    });
});
