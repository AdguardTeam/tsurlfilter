import { RuleParser } from '@adguard/agtree';
import { InputByteBuffer } from '@adguard/agtree/utils';
import { describe, expect, it } from 'vitest';

import { FilterListPreprocessor, PREPROCESSOR_AGTREE_OPTIONS } from '../../../src/filterlist/preprocessor';
import { BufferReader } from '../../../src/filterlist/reader/buffer-reader';

describe('BufferReader Test', () => {
    it('works if reader gets lines', () => {
        let reader;
        let entity;
        let processed;

        processed = FilterListPreprocessor.preprocess('');
        reader = new BufferReader(new InputByteBuffer(processed.filterList));
        expect(reader).toBeTruthy();
        expect(reader.readNext()).toBeFalsy();

        processed = FilterListPreprocessor.preprocess('rule1');
        reader = new BufferReader(new InputByteBuffer(processed.filterList));
        expect(reader).toBeTruthy();
        entity = reader.readNext();
        expect(entity).toStrictEqual(RuleParser.parse('rule1', PREPROCESSOR_AGTREE_OPTIONS));
        expect(reader.readNext()).toBeFalsy();
        expect(reader.readNext()).toBeFalsy();

        processed = FilterListPreprocessor.preprocess('rule1\n');
        reader = new BufferReader(new InputByteBuffer(processed.filterList));
        expect(reader).toBeTruthy();
        entity = reader.readNext();
        expect(entity).toStrictEqual(RuleParser.parse('rule1', PREPROCESSOR_AGTREE_OPTIONS));
        expect(reader.readNext()).toBeFalsy();
        expect(reader.readNext()).toBeFalsy();

        processed = FilterListPreprocessor.preprocess('rule1\nrule2');
        reader = new BufferReader(new InputByteBuffer(processed.filterList));
        expect(reader).toBeTruthy();
        entity = reader.readNext();
        expect(entity).toStrictEqual(RuleParser.parse('rule1', PREPROCESSOR_AGTREE_OPTIONS));
        entity = reader.readNext();
        expect(entity).toStrictEqual(RuleParser.parse('rule2', PREPROCESSOR_AGTREE_OPTIONS));
        expect(reader.readNext()).toBeFalsy();
        expect(reader.readNext()).toBeFalsy();
    });

    it('does not fall in infinite loop if line starts with "\\n"', () => {
        let reader;
        let processed;

        processed = FilterListPreprocessor.preprocess('');
        reader = new BufferReader(new InputByteBuffer(processed.filterList));
        expect(reader).toBeTruthy();
        expect(reader.readNext()).toBeFalsy();

        processed = FilterListPreprocessor.preprocess('\n rule');
        reader = new BufferReader(new InputByteBuffer(processed.filterList));
        expect(reader).toBeTruthy();
        expect(reader.readNext()).toStrictEqual(RuleParser.parse('rule', PREPROCESSOR_AGTREE_OPTIONS));

        // finally returns null
        expect(reader.readNext()).toBe(null);
    });
});
