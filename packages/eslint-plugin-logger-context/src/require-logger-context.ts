/**
 * @file
 * ESLint rule for requiring logger calls to include a context tag
 * e.g.  "[ext.page-handler]:" or "[tsweb.WebRequestApi.onBeforeRequest]:".
 */

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { RuleContext } from '@typescript-eslint/utils/ts-eslint';
import path from 'path';
import { LogMethod } from '@adguard/logger';
import {
    getEnclosingNames,
    buildTag,
    startsWithTag,
    createFix,
} from './helpers';

const DEFAULT_CONTEXT_MODULE_NAME = 'logger';
const DEFAULT_LOGGER_VARIABLE_NAME = 'logger';
const UNKNOWN_FILE_NAME = 'unknown';
const FILE_EXTENSIONS: ReadonlySet<string> = new Set([
    '.ts',
    '.js',
    '.tsx',
    '.jsx',
]);

/**
 * Options for require-logger-context ESLint rule.
 */
type Options = [
    {
        /**
         * Specifies the context module name to use in the tag. Defaults to 'logger'.
         */
        contextModuleName?: string;
        /**
         * Specifies the logger variable name to use in the tag.
         * Used to identify the logger instance variable name in the code to check all logger calls.
         * Defaults to 'logger'.
         */
        loggerVariableName?: string;
    }?,
];
type MessageIds = 'missingContextTag';

/**
 * Extracts the file name from the ESLint context.
 *
 * @param context The ESLint rule context.
 *
 * @returns The file name, or UNKNOWN_FILE_NAME if not a known extension.
 */
function getFileName(context: RuleContext<MessageIds, Options>): string {
    return (FILE_EXTENSIONS.has(path.extname(context.filename)))
        // Only filename without extension
        ? path.basename(context.filename).replace(path.extname(context.filename), '')
        : UNKNOWN_FILE_NAME;
}

/**
 * Rule definition for require-logger-context.
 */
const createRule = ESLintUtils.RuleCreator((ruleName) => (`https://example.com/rules/${ruleName}`));

export const requireLoggerContextRule = createRule<Options, MessageIds>({
    name: 'require-logger-context',
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
                    contextModuleName: { type: 'string' },
                    loggerVariableName: { type: 'string' },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            missingContextTag: 'Logger calls must start with a context tag, e.g. {{tag}} ...',
        },
    },
    defaultOptions: [{}],
    create(context, [options = {}]) {
        const contextModuleName = options.contextModuleName ?? DEFAULT_CONTEXT_MODULE_NAME;
        const loggerVariableName = options.loggerVariableName ?? DEFAULT_LOGGER_VARIABLE_NAME;
        const logLevelMethods = new Set<string>(Object.values(LogMethod));

        return {
            CallExpression(node: TSESTree.CallExpression): void {
                if (
                    node.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression
                    || node.callee.object.type !== TSESTree.AST_NODE_TYPES.Identifier
                    || node.callee.object.name !== loggerVariableName
                    || node.callee.property.type !== TSESTree.AST_NODE_TYPES.Identifier
                ) {
                    return;
                }
                const calledMethodName = node.callee.property.name;
                if (!logLevelMethods.has(calledMethodName)) {
                    return;
                }

                const fileName = getFileName(context);
                const { className, methodName } = getEnclosingNames(node);
                const tag = buildTag(contextModuleName, fileName, className, methodName);

                const firstArg = node.arguments[0];
                if (startsWithTag(firstArg, tag)) {
                    return;
                }

                const fix = createFix(context, node, tag);
                context.report({
                    node,
                    messageId: 'missingContextTag',
                    data: { tag },
                    fix,
                });
            },
        };
    },
});
