/**
 * Scriptlets helper class
 */
export class ScriptletParser {
    /**
     * Helper to accumulate an array of strings char by char
     */
    private static wordSaver() {
        let str = '';
        const strings: string[] = [];
        // eslint-disable-next-line no-return-assign
        const saveSymb = (s: string) => str += s;
        const saveStr = () => {
            strings.push(str);
            str = '';
        };
        const getAll = () => [...strings];
        return { saveSymb, saveStr, getAll };
    }

    /**
     * Iterate over iterable argument and evaluate current state with transitions
     *
     * @param {Array|Collection|string} iterable
     * @param {Object} transitions transition functions
     * @param {string} init first transition name
     * @param {any} args arguments which should be passed to transition functions
     */
    private static iterateWithTransitions(iterable: any, transitions: any, init: string, args: any) {
        let state = init || Object.keys(transitions)[0];
        for (let i = 0; i < iterable.length; i += 1) {
            state = transitions[state](iterable, i, args);
        }
        return state;
    }

    /**
     * Parse and validate scriptlet rule
     * @param {*} ruleContent
     * @returns {{name: string, args: Array<string>}}
     */
    public static parseRule(ruleContent: string) {
        /**
         * Transition names
         */
        const TRANSITION = {
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
         */
        // eslint-disable-next-line consistent-return
        const opened = (rule: string, index: number, { sep }: any) => {
            const char = rule[index];
            // eslint-disable-next-line default-case
            switch (char) {
                case ' ':
                case '(':
                case ',':
                    return TRANSITION.OPENED;
                case '\'':
                case '"':
                    // eslint-disable-next-line no-param-reassign
                    sep.symb = char;
                    return TRANSITION.PARAM;
                case ')':
                    return index === rule.length - 1
                        ? TRANSITION.CLOSED
                        : TRANSITION.OPENED;
            }
        };
        /**
         * Transition function: the current index position inside param
         * @param {string} rule
         * @param {number} index
         * @param {Object} Object
         * @property {Object} Object.sep contains prop `symb` with current separator char
         * @property {Object} Object.saver helper which allow to save strings by car by char
         */
        const param = (rule: string, index: number, { saver, sep }: any) => {
            const char = rule[index];
            switch (char) {
                case '\'':
                case '"':
                    // eslint-disable-next-line no-case-declarations
                    const before = rule[index - 1];
                    if (char === sep.symb && before !== '\\') {
                        // eslint-disable-next-line no-param-reassign
                        sep.symb = null;
                        saver.saveStr();
                        return TRANSITION.OPENED;
                    }
                // eslint-disable-next-line no-fallthrough
                default:
                    saver.saveSymb(char);
                    return TRANSITION.PARAM;
            }
        };
        const transitions = {
            [TRANSITION.OPENED]: opened,
            [TRANSITION.PARAM]: param,
            [TRANSITION.CLOSED]: () => { },
        };
        const sep = { symb: null };
        const saver = ScriptletParser.wordSaver();
        const state = ScriptletParser.iterateWithTransitions(
            ruleContent, transitions, TRANSITION.OPENED, { sep, saver },
        );
        if (state !== 'closed') {
            throw new Error(`Invalid scriptlet rule ${ruleContent}`);
        }

        const args = saver.getAll();
        return {
            name: args[0],
            args: args.slice(1),
        };
    }
}
