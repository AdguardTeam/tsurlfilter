/**
 * @file Utils re-exports.
 */

export { regionEquals } from './common';

// Network rule utils
export {
    isException,
    hasSeparator,
    getPatternStartIndex,
    getPatternEndIndex,
    getSeparatorIndex,
    patternEquals,
    getPattern,
} from './network-rule';

// Modifier list utils
export {
    getModifierCount,
    findModifierIndex,
    hasModifierNamed,
} from './modifier-list';

// Modifier utils
export {
    isModifierNegated,
    hasModifierValue,
    modifierNameEquals,
    getModifierName,
    getModifierValue,
    getModifierBounds,
} from './modifier';
