/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { RuleParser } from '@adguard/agtree/parser';

describe('root exports', () => {
    it('RuleParser', async () => {
        expect(RuleParser).toBeDefined();
    });
});
