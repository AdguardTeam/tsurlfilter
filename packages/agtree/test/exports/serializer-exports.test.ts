/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { RuleSerializer } from '@adguard/agtree/serializer';
// @ts-ignore
import { RuleGenerator } from '@adguard/agtree/generator';

describe('specific exports', () => {
    describe('RuleSerializer', () => {
        it('should export RuleSerializer', async () => {
            expect(RuleSerializer).toBeDefined();
        });
    });

    describe('RuleGenerator', () => {
        it('should export RuleGenerator', async () => {
            expect(RuleGenerator).toBeDefined();
        });
    });
});
