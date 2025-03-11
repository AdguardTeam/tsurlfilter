import type { ModifierValue } from '../../nodes';
import { EMPTY } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { AppListGenerator } from './app-list-generator';
import { DomainListGenerator } from './domain-list-generator';
import { MethodListGenerator } from './method-list-generator';
import { StealthOptionListGenerator } from './stealth-option-list-generator';
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
            case 'AppList': {
                result += AppListGenerator.generate(value);
                break;
            }
            case 'MethodList': {
                result += MethodListGenerator.generate(value);
                break;
            }
            case 'StealthOptionList': {
                result += StealthOptionListGenerator.generate(value);
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
