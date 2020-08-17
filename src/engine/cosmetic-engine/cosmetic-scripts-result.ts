import Scriptlets from 'scriptlets';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { ScriptletParser } from './scriptlet-parser';
import { config } from '../../configuration';
import { CosmeticContentResult } from './cosmetic-content-result';
import { ADG_SCRIPTLET_MASK } from '../../rules/cosmetic-rule-marker';

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticScriptsResult implements CosmeticContentResult {
    /**
     * Collection of generic (domain insensitive) rules
     */
    public generic: CosmeticRule[];

    /**
     * Collection of domain specific rules
     */
    public specific: CosmeticRule[];

    /**
     * Constructor
     */
    constructor() {
        this.generic = [];
        this.specific = [];
    }

    /**
     * Appends rule to appropriate collection
     * @param rule
     */
    append(rule: CosmeticRule): void {
        CosmeticScriptsResult.setScriptCode(rule);

        if (rule.isGeneric()) {
            this.generic.push(rule);
        } else {
            this.specific.push(rule);
        }
    }

    /**
     * Returns rules collected
     */
    getRules(): CosmeticRule[] {
        return [...this.generic, ...this.specific];
    }

    /**
     * Updates rule.script with js ready to execute
     *
     * @param rule
     */
    private static setScriptCode(rule: CosmeticRule): void {
        if (rule.script && rule.scriptVerbose) {
            // Already done for this rule
            return;
        }

        const ruleContent = rule.getContent();
        if (!ruleContent.startsWith(ADG_SCRIPTLET_MASK)) {
            // eslint-disable-next-line no-param-reassign
            rule.script = ruleContent;
            // eslint-disable-next-line no-param-reassign
            rule.scriptVerbose = ruleContent;
            return;
        }

        const scriptletContent = ruleContent.substr(ADG_SCRIPTLET_MASK.length);
        const scriptletParams = ScriptletParser.parseRule(scriptletContent);

        const params: Scriptlets.IConfiguration = {
            args: scriptletParams.args,
            engine: config.engine ? config.engine : '',
            name: scriptletParams.name,
            ruleText: rule.getText(),
            verbose: false,
            version: config.version ? config.version : '',
        };

        // eslint-disable-next-line no-param-reassign
        rule.script = Scriptlets.invoke(params);

        params.verbose = true;
        // eslint-disable-next-line no-param-reassign
        rule.scriptVerbose = Scriptlets.invoke(params);
    }
}
