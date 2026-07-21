/**
 * @file Utility functions for working with scriptlet nodes.
 */

import { NodeType, type ParameterList } from '../nodes-new';
import { EMPTY } from '../utils/constants';
import { QuoteType } from '../utils/quotes';
import { isNull, isUndefined } from '../utils/type-guards';

/**
 * Function to transform a parameter of the scriptlet node.
 *
 * @param param Parameter to transform or null if the parameter is not present.
 *
 * @returns Transformed parameter or null if the parameter should be removed.
 */
type ParamTransformer = (param: string | null) => string | null;

/**
 * Get name of the scriptlet from the scriptlet node.
 *
 * @param scriptletNode Scriptlet node to get name of.
 *
 * @returns Name of the scriptlet.
 *
 * @throws If the scriptlet is empty.
 */
export function getScriptletName(scriptletNode: ParameterList): string {
    if (scriptletNode.children.length === 0) {
        throw new Error('Empty scriptlet');
    }

    return scriptletNode.children[0]?.value ?? EMPTY;
}

/**
 * Transform the nth argument of the scriptlet node.
 *
 * @param scriptletNode Scriptlet node to transform argument of.
 * @param index Index of the argument to transform (index 0 is the scriptlet name).
 * @param transform Function to transform the argument.
 */
export function transformNthScriptletArgument(
    scriptletNode: ParameterList,
    index: number,
    transform: ParamTransformer,
): void {
    const child = scriptletNode.children[index];

    if (!isUndefined(child)) {
        const transformed = transform(child?.value ?? null);

        if (isNull(transformed)) {
            // eslint-disable-next-line no-param-reassign
            scriptletNode.children[index] = null;
            return;
        }

        if (isNull(child)) {
            // eslint-disable-next-line no-param-reassign
            scriptletNode.children[index] = {
                type: NodeType.Parameter,
                value: transformed,
                quoteType: QuoteType.None,
            };

            return;
        }

        child.value = transformed;
    }
}

/**
 * Transform all arguments of the scriptlet node.
 *
 * @param scriptletNode Scriptlet node to transform arguments of.
 * @param transform Function to transform the arguments.
 */
export function transformAllScriptletArguments(
    scriptletNode: ParameterList,
    transform: ParamTransformer,
): void {
    for (let i = 0; i < scriptletNode.children.length; i += 1) {
        transformNthScriptletArgument(scriptletNode, i, transform);
    }
}

/**
 * Set name of the scriptlet.
 * Modifies input `scriptletNode` if needed.
 *
 * @param scriptletNode Scriptlet node to set name of.
 * @param name Name to set.
 */
export function setScriptletName(scriptletNode: ParameterList, name: string): void {
    transformNthScriptletArgument(scriptletNode, 0, () => name);
}

/**
 * Set quote type of the scriptlet parameters.
 *
 * @param scriptletNode Scriptlet node to set quote type of.
 * @param quoteType Preferred quote type.
 */
export function setScriptletQuoteType(scriptletNode: ParameterList, quoteType: QuoteType): void {
    for (let i = 0; i < scriptletNode.children.length; i += 1) {
        const child = scriptletNode.children[i];

        // `null` represents an empty parameter. Materialize it as an explicit
        // empty-valued parameter so it is still quoted on output (e.g. `''`).
        if (isNull(child)) {
            // eslint-disable-next-line no-param-reassign
            scriptletNode.children[i] = {
                type: NodeType.Parameter,
                value: EMPTY,
                quoteType,
            };

            continue;
        }

        // `Parameter.value` is already the clean, unquoted value — only record
        // the desired quote type. The generator performs the escaping/wrapping.
        child.quoteType = quoteType;
    }
}
