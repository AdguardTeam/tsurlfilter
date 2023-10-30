import { TokenType } from '../../src/common/enums/token-types';
import { getBaseTokenName, getFormattedTokenName } from '../../src/utils/token-names';

describe('Token name utils', () => {
    describe('getBaseTokenName', () => {
        test('should work for existing token types', () => {
            expect(getBaseTokenName(TokenType.Comma)).toBe('comma');
        });

        test('should work for unknown token types', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(getBaseTokenName(999 as any)).toBe('unknown');
        });
    });

    describe('getFormattedTokenName', () => {
        test('should work for existing token types', () => {
            expect(getFormattedTokenName(TokenType.Comma)).toBe('<comma-token>');
        });

        test('should work for unknown token types', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(getFormattedTokenName(999 as any)).toBe('<unknown-token>');
        });
    });
});
