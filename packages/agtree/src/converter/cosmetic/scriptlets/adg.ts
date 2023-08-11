/**
 * @file Scriptlet conversions from ABP and uBO to ADG
 */

import cloneDeep from 'clone-deep';

import { QuoteType, QuoteUtils } from '../../../utils/quotes';
import { getScriptletName, setScriptletName, setScriptletQuoteType } from '../../../ast-utils/scriptlets';
import { type ParameterList } from '../../../parser/common';
import { type ConverterFunction } from '../../base-interfaces/converter-function';

const ABP_SCRIPTLET_PREFIX = 'abp-';
const UBO_SCRIPTLET_PREFIX = 'ubo-';

type Prefix = typeof ABP_SCRIPTLET_PREFIX | typeof UBO_SCRIPTLET_PREFIX;
type ScriptletConverterFunction = ConverterFunction<ParameterList>;

/**
 * Helper class for converting scriptlets from ABP and uBO to ADG
 */
export class AdgScriptletConverter {
    /**
     * Helper function to convert scriptlets to ADG. We implement the core
     * logic here to avoid code duplication.
     *
     * @param scriptletNode Scriptlet parameter list node to convert
     * @param prefix Prefix to add to the scriptlet name
     * @returns Converted scriptlet parameter list node
     */
    private static convertToAdg(scriptletNode: ParameterList, prefix: Prefix): ParameterList {
        // Remove possible quotes just to make it easier to work with the scriptlet name
        const scriptletName = QuoteUtils.setStringQuoteType(
            getScriptletName(scriptletNode),
            QuoteType.None,
        );

        // Clone the node to avoid any side effects
        let result = cloneDeep(scriptletNode);

        // Only add prefix if it's not already there
        if (!scriptletName.startsWith(prefix)) {
            result = setScriptletName(scriptletNode, `${prefix}${scriptletName}`);
        }

        // ADG scriptlet parameters should be quoted, and single quoted are preferred
        result = setScriptletQuoteType(result, QuoteType.Single);

        return result;
    }

    /**
     * Converts an ABP snippet node to ADG scriptlet node, if possible.
     *
     * @param scriptletNode Scriptlet node to convert
     * @returns Converted scriptlet node
     * @throws If the scriptlet isn't supported by ADG or is invalid
     * @see {@link https://help.adblockplus.org/hc/en-us/articles/1500002338501#snippets-ref}
     */
    public static convertFromAbp: ScriptletConverterFunction = (scriptletNode) => {
        return AdgScriptletConverter.convertToAdg(scriptletNode, ABP_SCRIPTLET_PREFIX);
    };

    /**
     * Convert a uBO scriptlet node to ADG scriptlet node, if possible.
     *
     * @param scriptletNode Scriptlet node to convert
     * @returns Converted scriptlet node
     * @throws If the scriptlet isn't supported by ADG or is invalid
     * @see {@link https://github.com/gorhill/uBlock/wiki/Resources-Library#available-general-purpose-scriptlets}
     */
    public static convertFromUbo: ScriptletConverterFunction = (scriptletNode) => {
        return AdgScriptletConverter.convertToAdg(scriptletNode, UBO_SCRIPTLET_PREFIX);
    };
}
