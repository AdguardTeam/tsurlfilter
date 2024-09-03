/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Scriptlets helper class
 */
// eslint-disable-next-line max-classes-per-file
export class ScriptletParser {
    /**
     * Helper class to accumulate an array of strings char by char
     */
    private static WordSaver = class {
        /**
         * String cursor
         */
        private str = '';

        /**
         * Strings array
         */
        private collectedStrings: string[] = [];

        /**
         * Saves symbol to cursor
         *
         * @param s
         */
        public saveSymbol(s: string): void {
            this.str += s;
        }

        /**
         * Saves cursor to strings
         */
        public saveStr(): void {
            this.collectedStrings.push(this.str);
            this.str = '';
        }

        /**
         * Returns collected strings
         */
        public getAll(): string[] {
            return [...this.collectedStrings];
        }
    };

    /**
     * Iterate over iterable argument and evaluate current state with transitions
     *
     * @param {Array|Collection|string} iterable
     * @param {Object} transitions transition functions
     * @param {string} initState first transition name
     * @param {any} args arguments which should be passed to transition functions
     * @returns {string} transition
     */
    private static iterateWithTransitions(iterable: string, transitions: any, initState: string, args: any): string {
        let state = initState;
        for (let i = 0; i < iterable.length; i += 1) {
            state = transitions[state](iterable, i, args);
        }

        return state;
    }

    /**
     * Transition names
     */
    private static TRANSITION = {
        OPENED: 'opened',
        PARAM: 'param',
        CLOSED: 'closed',
    };

    /**
     * Transition function: the current index position in start, end or between params
     * @param {string} rule
     * @param {number} index
     * @param {Object} Object
     * @property {Object} Object.sep contains prop symb with current separator char
     * @returns {string} transition
     */
    private static opened = (rule: string, index: number, { sep }: any): string | undefined => {
        const char = rule[index];
        switch (char) {
            case ' ':
            case '(':
            case ',':
                return ScriptletParser.TRANSITION.OPENED;
            case '\'':
            case '"':
                // eslint-disable-next-line no-param-reassign
                sep.symb = char;
                return ScriptletParser.TRANSITION.PARAM;
            case ')':
                return index === rule.length - 1
                    ? ScriptletParser.TRANSITION.CLOSED
                    : ScriptletParser.TRANSITION.OPENED;
            default:
        }

        return undefined;
    };

    /**
     * Transition function: the current index position inside param
     *
     * @param {string} rule
     * @param {number} index
     * @param {Object} Object
     * @property {Object} Object.sep contains prop `symb` with current separator char
     * @property {Object} Object.saver helper which allow to save strings by car by char
     * @returns {string} transition
     */
    private static param = (rule: string, index: number, { saver, sep }: any): string => {
        const char = rule[index];
        switch (char) {
            case '\'':
            case '"':
                if (char === sep.symb && rule[index - 1] !== '\\') {
                    // eslint-disable-next-line no-param-reassign
                    sep.symb = null;
                    saver.saveStr();
                    return ScriptletParser.TRANSITION.OPENED;
                }
                saver.saveSymbol(char);
                return ScriptletParser.TRANSITION.PARAM;
            default:
                saver.saveSymbol(char);
                return ScriptletParser.TRANSITION.PARAM;
        }
    };

    /**
     * Parse and validate scriptlet rule
     * @param {*} ruleContent
     * @returns {{name: string, args: Array<string>}}
     */
    public static parseRule(ruleContent: string): { name: string; args: string[] } {
        const transitions = {
            [ScriptletParser.TRANSITION.OPENED]: ScriptletParser.opened,
            [ScriptletParser.TRANSITION.PARAM]: ScriptletParser.param,
            [ScriptletParser.TRANSITION.CLOSED]: (): void => { },
        };

        const sep = { symb: null };
        const saver = new ScriptletParser.WordSaver();

        const state = ScriptletParser.iterateWithTransitions(
            ruleContent,
            transitions,
            ScriptletParser.TRANSITION.OPENED,
            { sep, saver },
        );

        if (state !== 'closed') {
            throw new Error(`Invalid scriptlet ${ruleContent}`);
        }

        const args = saver.getAll();
        return {
            name: args[0],
            args: args.slice(1),
        };
    }
}
