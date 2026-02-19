/**
 * @file Compatibility tables for modifiers.
 */

import { sprintf } from 'sprintf-js';

import { CompatibilityTableBase } from './base';
import { type ModifierDataSchema } from './schemas';
import { modifiersCompatibilityTableData } from './compatibility-table-data';
import { UNDERSCORE } from '../utils/constants';
import { type CompatibilityTable } from './types';
import { deepFreeze } from '../utils/deep-freeze';
import { isValidNoopModifier } from '../utils/noop-modifier';
import { type Modifier } from '../nodes';
import { ModifierParser } from '../parser/misc/modifier-parser';
import { defaultParserOptions } from '../parser/options';
import { type Platform } from './platform';
import { VALIDATION_ERROR_PREFIX, SOURCE_DATA_ERROR_PREFIX } from '../validator/constants';
import { isString } from '../utils/type-guards';
import { getErrorMessage } from '../utils/error';
import { isKnownValidator, validate } from './validators';
import { type ValidationContext } from './validators/types';

/**
 * Transforms the name of the modifier to a normalized form.
 * This is a special case: the noop modifier normally '_', but it can consist of any number of characters,
 * e.g. '____' is also valid. In this case, we need to normalize the name to '_'.
 *
 * @param name Modifier name to normalize.
 * @returns Normalized modifier name.
 */
const noopModifierNameNormalizer = (name: string): string => {
    if (name.startsWith(UNDERSCORE)) {
        if (isValidNoopModifier(name)) {
            // in compatibility tables, we just store '_', so we need to reduce the number of underscores to 1
            // before checking the existence of the noop modifier
            return UNDERSCORE;
        }
    }

    return name;
};

/**
 * Compatibility table for modifiers.
 */
class ModifiersCompatibilityTable extends CompatibilityTableBase<ModifierDataSchema> {
    /**
     * Creates a new instance of the compatibility table for modifiers.
     *
     * @param data Compatibility table data.
     */
    constructor(data: CompatibilityTable<ModifierDataSchema>) {
        super(data, noopModifierNameNormalizer);
    }

    /**
     * Validates a modifier against the compatibility table.
     *
     * @param data Modifier as string (to be parsed) or already parsed Modifier node.
     * @param ctx Validation context to collect issues into.
     * @param platform Platform to validate against.
     * @param isExceptionRule Whether the modifier is used in an exception rule (default: false).
     * @param ruleModifierNames Set of modifier names in the current rule (for conflict detection).
     */
    public validate(
        data: Modifier | string,
        ctx: ValidationContext,
        platform?: Platform,
        isExceptionRule?: boolean,
        ruleModifierNames?: Set<string>,
    ): void {
        if (platform === undefined) {
            throw new Error('Platform is required for modifier validation');
        }

        let modifier: Modifier;

        if (isString(data)) {
            try {
                modifier = ModifierParser.parse(data, defaultParserOptions);
            } catch (error) {
                ctx.addError(getErrorMessage(error));
                return;
            }
        } else {
            modifier = data;
        }

        const normalizedName = this.nameTransformer
            ? this.nameTransformer(modifier.name.value)
            : modifier.name.value;

        const specificBlockerData = this.get(normalizedName, platform);

        if (!specificBlockerData) {
            ctx.addErrorFromNode(
                sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, platform.toHumanReadable()),
                modifier,
            );
            return;
        }

        if (specificBlockerData.removed) {
            ctx.addErrorFromNode(
                `${VALIDATION_ERROR_PREFIX.REMOVED}: '${normalizedName}'`,
                modifier,
            );
            return;
        }

        if (specificBlockerData.deprecated) {
            ctx.addWarningFromNode(
                `Deprecated modifier: '${normalizedName}'`,
                modifier,
            );
        }

        if (specificBlockerData.blockOnly && isExceptionRule) {
            ctx.addErrorFromNode(
                `${VALIDATION_ERROR_PREFIX.BLOCK_ONLY}: '${normalizedName}'`,
                modifier,
            );
        }

        if (specificBlockerData.exceptionOnly && !isExceptionRule) {
            ctx.addErrorFromNode(
                `${VALIDATION_ERROR_PREFIX.EXCEPTION_ONLY}: '${normalizedName}'`,
                modifier,
            );
        }

        if (!specificBlockerData.negatable && modifier.exception) {
            ctx.addErrorFromNode(
                `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER}: '${normalizedName}'`,
                modifier,
            );
        }

        if (specificBlockerData.assignable) {
            if (!modifier.value) {
                if (specificBlockerData.valueOptional) {
                    return;
                }
                ctx.addErrorFromNode(
                    `${VALIDATION_ERROR_PREFIX.VALUE_REQUIRED}: '${normalizedName}'`,
                    modifier,
                );
                return;
            }

            if (!specificBlockerData.valueFormat) {
                throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_VALUE_FORMAT_FOR_ASSIGNABLE}: '${normalizedName}'`);
            }

            this.validateValue(
                modifier,
                specificBlockerData.valueFormat,
                specificBlockerData.valueFormatFlags,
                ctx,
            );
            return;
        }

        if (modifier.value) {
            ctx.addErrorFromNode(
                `${VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN}: '${normalizedName}'`,
                modifier.value,
            );
        }

        if (specificBlockerData.conflicts) {
            for (const conflict of specificBlockerData.conflicts) {
                const hasConflict = ruleModifierNames?.has(conflict);
                if (specificBlockerData.inverseConflicts ? !hasConflict : hasConflict) {
                    ctx.addErrorFromNode(
                        `${VALIDATION_ERROR_PREFIX.CONFLICTS_WITH}: '${conflict}'`,
                        modifier,
                    );
                }
            }
        }
    }

    /**
     * Checks whether the value for given `modifier` is valid.
     *
     * @param modifier Modifier AST node.
     * @param valueFormat Value format for the modifier.
     * @param valueFormatFlags Optional; RegExp flags for the value format.
     * @param ctx Validation context to collect issues into.
     */
    // eslint-disable-next-line class-methods-use-this
    private validateValue(
        modifier: Modifier,
        valueFormat: string,
        valueFormatFlags: string | null | undefined,
        ctx: ValidationContext,
    ): void {
        const modifierName = modifier.name.value;
        const modifierValue = modifier.value?.value ?? '';

        if (isKnownValidator(valueFormat)) {
            validate(valueFormat, modifierValue, ctx);
            return;
        }

        let regExp: RegExp;
        try {
            if (isString(valueFormatFlags)) {
                regExp = new RegExp(valueFormat, valueFormatFlags);
            } else {
                regExp = new RegExp(valueFormat);
            }
        } catch (e) {
            throw new Error(`${SOURCE_DATA_ERROR_PREFIX.INVALID_VALUE_FORMAT_REGEXP}: '${modifierName}'`);
        }

        const isValid = regExp.test(modifierValue);
        if (!isValid) {
            ctx.addErrorFromNode(
                `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`,
                modifier.value ?? modifier,
            );
        }
    }
}

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(modifiersCompatibilityTableData);

/**
 * Compatibility table instance for modifiers.
 */
export const modifiersCompatibilityTable = new ModifiersCompatibilityTable(modifiersCompatibilityTableData);
