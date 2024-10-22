/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { RuleParser } from '@adguard/agtree/parser';
// @ts-ignore
import { RuleGenerator } from '@adguard/agtree/generator';
// @ts-ignore
import { RuleSerializer } from '@adguard/agtree/serializer';
// @ts-ignore
import { RuleDeserializer } from '@adguard/agtree/deserializer';

describe('specific exports', () => {
    describe('RuleParser', () => {
        it('should export RuleParser', async () => {
            expect(RuleParser).toBeDefined();
        });
    });

    describe('RuleGenerator', () => {
        it('should export RuleGenerator', async () => {
            expect(RuleGenerator).toBeDefined();
        });
    });

    describe('RuleSerializer', () => {
        it('should export RuleSerializer', async () => {
            expect(RuleSerializer).toBeDefined();
        });
    });

    describe('RuleDeserializer', () => {
        it('should export RuleDeserializer', () => {
            expect(RuleDeserializer).toBeDefined();
        });
    });
});
