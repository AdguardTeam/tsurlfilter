import Scriptlets from 'scriptlets';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { ScriptletParser } from './scriptlet-parser';
import { config } from '../../configuration';
import { CosmeticContentResult } from './cosmetic-content-result';

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticScriptsResult implements CosmeticContentResult {
    /**
     * AdGuard scriptlet rule mask
     */
    private static ADG_SCRIPTLET_MASK = '//scriptlet';

    /**
     * Collection of generic (domain insensitive) rules
     */
    public generic: string[];

    /**
     * Collection of domain specific rules
     */
    public specific: string[];

    /**
     * Rules
     */
    private rules: CosmeticRule[] = [];

    constructor() {
        this.generic = [] as string[];
        this.specific = [] as string[];
    }

    /**
     * Appends rule to appropriate collection
     * @param rule
     */
    append(rule: CosmeticRule): void {
        let ruleContent = rule.getContent();
        if (ruleContent.startsWith(CosmeticScriptsResult.ADG_SCRIPTLET_MASK)) {
            const scriptCode = CosmeticScriptsResult.getScriptCode(rule);
            ruleContent = scriptCode ? scriptCode! : '';
        }

        if (rule.isGeneric()) {
            this.generic.push(ruleContent);
        } else {
            this.specific.push(ruleContent);
        }

        this.rules.push(rule);
    }

    /**
     * Returns rules collected
     */
    getRules(): CosmeticRule[] {
        return this.rules;
    }

    /**
     * Returns script ready to execute
     *
     * @param rule
     */
    private static getScriptCode(rule: CosmeticRule): string | null {
        const scriptletContent = rule.getContent().substr(CosmeticScriptsResult.ADG_SCRIPTLET_MASK.length);
        const scriptletParams = ScriptletParser.parseRule(scriptletContent);

        if (rule.script) {
            return rule.script;
        }

        const params: Scriptlets.IConfiguration = {
            args: scriptletParams.args,
            engine: config.engine ? config.engine : '',
            name: scriptletParams.name,
            ruleText: rule.getText(),
            verbose: config.verbose,
            version: config.version ? config.version : '',
        };

        // eslint-disable-next-line no-param-reassign
        rule.script = Scriptlets.invoke(params);

        return rule.script;
    }
}
