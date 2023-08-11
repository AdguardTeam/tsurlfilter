/**
 * @file Utility functions for working with scriptlet nodes
 */

import cloneDeep from 'clone-deep';

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
 * Set name of the scriptlet
 *
 * @param scriptletNode Scriptlet node to set name of
 * @param name Name to set
 * @returns Scriptlet node with the specified name
 * @throws If the scriptlet is empty
 */
export function setScriptletName(scriptletNode: ParameterList, name: string): ParameterList {
    if (scriptletNode.children.length === 0) {
        throw new Error('Empty scriptlet');
    }

    const scriptletNodeClone = cloneDeep(scriptletNode);
    scriptletNodeClone.children[0].value = name;

    return scriptletNodeClone;
}

/**
 * Set quote type of the scriptlet parameters
 *
 * @param scriptletNode Scriptlet node to set quote type of
 * @param quoteType Preferred quote type
 * @returns Scriptlet node with the specified quote type
 */
export function setScriptletQuoteType(scriptletNode: ParameterList, quoteType: QuoteType): ParameterList {
    if (scriptletNode.children.length === 0) {
        throw new Error('Empty scriptlet');
    }

    const scriptletNodeClone = cloneDeep(scriptletNode);

    for (let i = 0; i < scriptletNodeClone.children.length; i += 1) {
        scriptletNodeClone.children[i].value = QuoteUtils.setStringQuoteType(
            scriptletNodeClone.children[i].value,
            quoteType,
        );
    }

    return scriptletNodeClone;
}
