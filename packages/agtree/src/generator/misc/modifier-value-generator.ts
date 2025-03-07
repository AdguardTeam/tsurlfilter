import type { ModifierValue } from '../../nodes';
import { EMPTY } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { DomainListGenerator } from './domain-list-generator';
import { ValueGenerator } from './value-generator';

/**
 * Generator for modifier value nodes.
 */
export class ModifierValueGenerator extends BaseGenerator {
    /**
     * Converts a modifier value AST node to a string.
     *
     * @param value Modifier value AST node to convert
     * @returns String representation of the modifier value
     */
    public static generate(value: ModifierValue): string {
        let result = EMPTY;

        switch (value.type) {
            case 'Value': {
                result += ValueGenerator.generate(value);
                break;
            }
            case 'DomainList': {
                result += DomainListGenerator.generate(value);
                break;
            }
            default: {
                // During normal operation, this should never happen
                throw new Error('Unsupported modifier value type');
            }
        }

        return result;
    }
}
