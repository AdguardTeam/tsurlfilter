import { ADG_SCRIPTLET_MASK, QuoteType, QuoteUtils } from '@adguard/agtree';

import { EMPTY_STRING } from '../common/constants';

/**
 * Represents scriptlet properties parsed from the rule content.
 */
export type ScriptletsProps = {
    /**
     * Scriptlet name.
     */
    name: string;

    /**
     * Scriptlet arguments.
     */
    args: string[];
};

/**
 * Represents scriptlet properties parsed from the rule content.
 */
export class ScriptletParams {
    /**
     * Scriptlet properties.
     */
    private props: ScriptletsProps | null = null;

    /**
     * ScriptletParams constructor.
     *
     * @param name Scriptlet name.
     * @param args Scriptlet arguments.
     */
    constructor(name?: string, args?: string[]) {
        if (typeof name !== 'undefined') {
            this.props = {
                name,
                args: args || [],
            };
        }
    }

    /**
     * Gets scriptlet name.
     *
     * @returns Scriptlet name.
     */
    public get name(): string | undefined {
        return this.props?.name;
    }

    /**
     * Gets scriptlet arguments.
     *
     * @returns Scriptlet arguments.
     */
    public get args(): string[] {
        return this.props?.args ?? [];
    }

    /**
     * Gets string representation of scriptlet parameters.
     *
     * @returns String representation of scriptlet parameters.
     */
    public toString(): string {
        const result: string[] = [];

        result.push(ADG_SCRIPTLET_MASK);
        result.push('(');

        if (this.name) {
            result.push(QuoteUtils.setStringQuoteType(this.name, QuoteType.Single));
        }

        if (this.args.length) {
            result.push(', ');
            result.push(this.args.map((arg) => QuoteUtils.setStringQuoteType(arg, QuoteType.Single)).join(', '));
        }

        result.push(')');

        return result.join(EMPTY_STRING);
    }
}
