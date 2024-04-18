import { ADG_SCRIPTLET_MASK } from './cosmetic-rule-marker';
import { ScriptletParser, type ScriptletsProps } from '../engine/cosmetic-engine/scriptlet-parser';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../common/error';

/**
 * Represents scriptlet parameters parsed from the rule content.
 * It is used in the lazy way, so the parsing is done only when the properties are accessed.
 */
export class ScriptletsParams {
    /**
     * Parsed scriptlet properties
     */
    parsedProps: ScriptletsProps | null = null;

    /**
     * Scriptlet rule content
     */
    ruleContent: string;

    constructor(content: string) {
        this.ruleContent = content;
    }

    /**
     * Adjusts quote escaping in a string. Escapes single quotes unless already escaped and unescapes
     * escaped double quotes.
     * Ensures single quotes are properly escaped while normalized double quotes are unescaped.
     *
     * @param scriptletArgument The string to process.
     * @returns The processed string with adjusted quote escaping.
     */
    private static adjustQuoteEscaping(scriptletArgument: string): string {
        let result = '';
        for (let i = 0; i < scriptletArgument.length; i += 1) {
            const char = scriptletArgument[i];
            const prevChar = scriptletArgument[i - 1];
            if (char === '\'' && (i === 0 || prevChar !== '\\')) {
                result += '\\\'';
            } else if (char === '"' && (i > 0 && prevChar === '\\')) {
                result = result.slice(0, -1) + char;
            } else {
                result += char;
            }
        }
        return result;
    }

    /**
     * Returns normalized string representation of the scriptlet rule content
     */
    toString(): string {
        if (!this.name) {
            return `${ADG_SCRIPTLET_MASK}()`;
        }

        // Process arguments to handle escaping properly
        const args = this.args.map(ScriptletsParams.adjustQuoteEscaping);

        const ARG_DELIM = "', '";

        return args.length
            ? `${ADG_SCRIPTLET_MASK}('${this.name}${ARG_DELIM}${args.join(ARG_DELIM)}')`
            : `${ADG_SCRIPTLET_MASK}('${this.name}')`;
    }

    /**
     * Parses name and arguments from the scriptlet rule content
     */
    get props() {
        if (!this.parsedProps) {
            const scriptletContent = this.ruleContent.substring(ADG_SCRIPTLET_MASK.length);
            try {
                this.parsedProps = ScriptletParser.parseRule(scriptletContent);
            } catch (e) {
                logger.error(getErrorMessage(e));
            }
        }
        return this.parsedProps;
    }

    /**
     * Returns scriptlet name, if present
     */
    get name(): string | undefined {
        return this.props?.name;
    }

    /**
     * Returns scriptlet arguments
     */
    get args(): string[] {
        if (!this.props) {
            return [];
        }
        return this.props.args;
    }
}
