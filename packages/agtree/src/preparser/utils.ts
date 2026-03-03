/**
 * @file Utils — re-exports from split modules.
 *
 * @deprecated Import from './utils/' instead.
 */

export {
    isException,
    hasSeparator,
    getPatternStartIndex,
    getPatternEndIndex,
    getSeparatorIndex,
    patternEquals,
    getPattern,
} from './utils/network-rule';

export {
    getModifierCount,
    findModifierIndex,
    hasModifierNamed,
} from './utils/modifier-list';

export {
    isModifierNegated,
    hasModifierValue,
    modifierNameEquals,
    getModifierName,
    getModifierValue,
    getModifierBounds,
} from './utils/modifier';
