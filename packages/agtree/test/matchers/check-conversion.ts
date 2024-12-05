/**
 * @file Custom Jest matcher to check proper rule conversion
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { z } from 'zod';

import { type ConverterBase } from '../../src/converter/base-interfaces/converter-base';
import { RuleParser } from '../../src/parser/rule';
import { everyRefsAreDifferent } from '../helpers/refs';
import { getErrorMessage } from '../../src/utils/error';
import { type AnyRule } from '../../src/parser/common';
import { type NodeConversionResult } from '../../src/converter/base-interfaces/conversion-result';

// Extend Jest's global namespace with the custom matcher
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest {
        interface Matchers<R> {
            toBeConvertedProperly(converter: ConverterBase, method: string): R;
        }
    }
}

/**
 * Schema for the received parameter from expect()
 */
const receivedSchema = z.object({
    /**
     * Rule to convert (original rule text)
     */
    actual: z.string(),

    /**
     * Expected result (array of converted rule texts)
     */
    expected: z.array(z.string()),

    /**
     * Whether the rule should be converted or not
     * If not specified, defaults to true
     */
    shouldConvert: z.boolean().optional().default(true),
});

/**
 * Type based on the zod schema
 */
type ReceivedSchema = z.infer<typeof receivedSchema>;

// Extend Jest's expect() with the custom matcher
expect.extend({
    /**
     * Helper function to check rule conversion
     *
     * @param received Received parameter from expect()
     * @param converter Converter instance
     * @param method Method name to call on the converter
     * @returns Jest matcher result
     */
    // eslint-disable-next-line max-len
    toBeConvertedProperly(received: unknown, converter: ConverterBase, method: string): jest.CustomMatcherResult {
        // Validate the received parameter with the zod schema
        let receivedParsed: ReceivedSchema;

        try {
            receivedParsed = receivedSchema.parse(received);
        } catch (error: unknown) {
            return {
                pass: false,
                message: () => `Received parameter validation failed with error: ${getErrorMessage(error)}`,
            };
        }

        // Parse the adblock rule with AGTree
        let ruleNode: AnyRule;

        try {
            ruleNode = RuleParser.parse(receivedParsed.actual);
        } catch (error: unknown) {
            return {
                pass: false,
                message: () => `Rule parsing failed with error: ${getErrorMessage(error)}`,
            };
        }

        if (ruleNode === null) {
            return {
                pass: false,
                message: () => 'Parsing failed, null returned',
            };
        }

        // Convert the rule with the specified converter
        let conversionResult: NodeConversionResult<AnyRule>;

        try {
            conversionResult = converter[method](ruleNode);
        } catch (error: unknown) {
            return {
                pass: false,
                message: () => `Conversion failed with error: ${getErrorMessage(error)}`,
            };
        }

        // Check the conversion result
        if (!(conversionResult instanceof Object)) {
            return {
                pass: false,
                message: () => `Conversion failed, non-object returned: ${conversionResult}`,
            };
        }

        if (!('isConverted' in conversionResult)) {
            return {
                pass: false,
                message: () => `Conversion failed, no "isConverted" property: ${conversionResult}`,
            };
        }

        if (conversionResult.isConverted !== receivedParsed.shouldConvert) {
            return {
                pass: false,
                // eslint-disable-next-line max-len
                message: () => `Conversion failed, "isConverted" is ${conversionResult.isConverted} instead of ${receivedParsed.shouldConvert}`,
            };
        }

        if (!('result' in conversionResult)) {
            return {
                pass: false,
                message: () => `Conversion failed, no "result" property: ${conversionResult}`,
            };
        }

        if (!Array.isArray(conversionResult.result)) {
            return {
                pass: false,
                message: () => `Conversion failed, "result" is not an array: ${conversionResult.result}`,
            };
        }

        if (conversionResult.result.length !== receivedParsed.expected.length) {
            return {
                pass: false,
                // eslint-disable-next-line max-len
                message: () => `Conversion failed, "result" array has wrong length: ${conversionResult.result.length} instead of ${receivedParsed.expected.length}`,
            };
        }

        if (conversionResult.isConverted) {
            // If the rule was converted, object references should be different
            if (!everyRefsAreDifferent(ruleNode, ...conversionResult.result)) {
                return {
                    pass: false,
                    message: () => 'Conversion failed, converted rule hasn\'t been cloned properly',
                };
            }
        } else {
            // If the rule was not converted, the object reference should be the same, and only one rule should be
            // returned
            if (conversionResult.result.length !== 1) {
                return {
                    pass: false,
                    // eslint-disable-next-line max-len
                    message: () => `Conversion failed, "result" array has wrong length: ${conversionResult.result.length} instead of 1`,
                };
            }

            if (everyRefsAreDifferent(ruleNode, ...conversionResult.result)) {
                return {
                    pass: false,
                    message: () => 'Conversion failed, conversion result is cloned unnecessarily',
                };
            }
        }

        // Finally, we should compare the stringified versions of the nodes
        expect(conversionResult.result.map(RuleParser.generate)).toEqual(receivedParsed.expected);

        return {
            pass: true,
            message: () => 'Conversion succeeded',
        };
    },
});
