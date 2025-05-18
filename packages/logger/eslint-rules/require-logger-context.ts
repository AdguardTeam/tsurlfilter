/**
 * @file
 * ESLint rule for requiring logger calls to include a context tag
 * e.g.  "[ext.page-handler]:" or "[tsweb.WebRequestApi.onBeforeRequest]:".
 */

import type { Rule } from 'eslint';
import { LogLevel } from '../src';
import {
    getEnclosingNames, buildTag, startsWithTag, createFix,
} from './helpers';

const DEFAULT_CONTEXT_MODULE_NAME = 'logger';
const DEFAULT_LOGGER_VARIABLE_NAME = 'logger';

/**
 * Helper to extract the file name from the context.
 *
 * @param context The ESLint context.
 *
 * @returns The file name.
 */
function getFileName(context: Rule.RuleContext): string {
    return (context.getFilename().match(/([^/\\]+)\.(ts|js|tsx|jsx)$/) || [])[1] || 'unknown';
}

/**
 * Rule definition for require-logger-context.
 */
export const requireLoggerContextRule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require logger calls to include a context tag',
        },
        fixable: 'code',
        schema: [
            {
                type: 'object',
                properties: {
                    /**
                     * Specifies the context module name to use in the tag.
                     * Defaults to 'logger'.
                     */
                    CONTEXT_MODULE_NAME: { type: 'string' },

                    /**
                     * Specifies the logger variable name to use in the tag.
                     * Used to identify the logger instance variable name
                     * in the code to check all logger calls.
                     * Defaults to 'logger'.
                     */
                    LOGGER_VARIABLE_NAME: { type: 'string' },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options = (context.options && context.options[0]) || {};
        const contextModuleName = options.CONTEXT_MODULE_NAME || DEFAULT_CONTEXT_MODULE_NAME;
        const loggerVariableName = options.LOGGER_VARIABLE_NAME || DEFAULT_LOGGER_VARIABLE_NAME;
        const logLevelMethods = Object.values(LogLevel);

        return {
            /**
             * Checks logger calls for the required context tag and reports/fixes violations.
             *
             * @param node The AST node.
             */
            CallExpression(node: any): void {
                // Only match logger.<level>() calls
                if (node.callee.type !== 'MemberExpression' || node.callee.object.name !== loggerVariableName) {
                    return;
                }
                const calledMethodName = node.callee.property.name;
                if (!logLevelMethods.includes(calledMethodName)) {
                    return;
                }

                // Use class and method name if available, otherwise fallback to file name
                const fileName = getFileName(context);
                const { className, methodName } = getEnclosingNames(node);
                const tag = buildTag(contextModuleName, fileName, className, methodName);
                const firstArg = node.arguments[0];
                const isValid = startsWithTag(firstArg, tag);
                if (isValid) {
                    return;
                }

                const fix = createFix(context, node, tag);
                context.report({
                    node,
                    message: `Logger calls must start with a context tag, e.g. ${tag} ...`,
                    fix,
                });
            },
        };
    },
};
