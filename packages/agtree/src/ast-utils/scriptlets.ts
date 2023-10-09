/**
 * @file Utility functions for working with scriptlet nodes
 */

import { type ParameterList } from '../parser/common';
import { type QuoteType, QuoteUtils } from '../utils/quotes';

/**
 * Get name of the scriptlet from the scriptlet node
 *
 * @param scriptletNode Scriptlet node to get name of
 * @returns Name of the scriptlet
 * @throws If the scriptlet is empty
 */
export function getScriptletName(scriptletNode: ParameterList): string {
    if (scriptletNode.children.length === 0) {
        throw new Error('Empty scriptlet');
    }

    return scriptletNode.children[0].value;
}

/**
 * Set name of the scriptlet.
 * Modifies input `scriptletNode` if needed.
 *
 * @param scriptletNode Scriptlet node to set name of
 * @param name Name to set
 */
export function setScriptletName(scriptletNode: ParameterList, name: string): void {
    if (scriptletNode.children.length > 0) {
        // eslint-disable-next-line no-param-reassign
        scriptletNode.children[0].value = name;
    }
}

/**
 * Set quote type of the scriptlet parameters
 *
 * @param scriptletNode Scriptlet node to set quote type of
 * @param quoteType Preferred quote type
 */
export function setScriptletQuoteType(scriptletNode: ParameterList, quoteType: QuoteType): void {
    if (scriptletNode.children.length > 0) {
        for (let i = 0; i < scriptletNode.children.length; i += 1) {
            // eslint-disable-next-line no-param-reassign
            scriptletNode.children[i].value = QuoteUtils.setStringQuoteType(
                scriptletNode.children[i].value,
                quoteType,
            );
        }
    }
}
