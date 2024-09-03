'use strict';

var astUtils = require('@typescript-eslint/utils/ast-utils');
require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

var functionCallSpacing = utils.createRule({
  name: "function-call-spacing",
  meta: {
    type: "layout",
    docs: {
      description: "Require or disallow spacing between function identifiers and their invocations"
    },
    fixable: "whitespace",
    schema: {
      anyOf: [
        {
          type: "array",
          items: [
            {
              type: "string",
              enum: ["never"]
            }
          ],
          minItems: 0,
          maxItems: 1
        },
        {
          type: "array",
          items: [
            {
              type: "string",
              enum: ["always"]
            },
            {
              type: "object",
              properties: {
                allowNewlines: {
                  type: "boolean"
                }
              },
              additionalProperties: false
            }
          ],
          minItems: 0,
          maxItems: 2
        }
      ]
    },
    messages: {
      unexpectedWhitespace: "Unexpected whitespace between function name and paren.",
      unexpectedNewline: "Unexpected newline between function name and paren.",
      missing: "Missing space between function name and paren."
    }
  },
  defaultOptions: ["never", {}],
  create(context, [option, config]) {
    const sourceCode = context.sourceCode;
    const text = sourceCode.getText();
    function checkSpacing(node) {
      const isOptionalCall = astUtils.isOptionalCallExpression(node);
      const closingParenToken = sourceCode.getLastToken(node);
      const lastCalleeTokenWithoutPossibleParens = sourceCode.getLastToken(
        node.typeArguments ?? node.callee
      );
      const openingParenToken = sourceCode.getFirstTokenBetween(
        lastCalleeTokenWithoutPossibleParens,
        closingParenToken,
        astUtils.isOpeningParenToken
      );
      if (!openingParenToken || openingParenToken.range[1] >= node.range[1]) {
        return;
      }
      const lastCalleeToken = sourceCode.getTokenBefore(
        openingParenToken,
        astUtils.isNotOptionalChainPunctuator
      );
      const textBetweenTokens = text.slice(lastCalleeToken.range[1], openingParenToken.range[0]).replace(/\/\*.*?\*\//gu, "");
      const hasWhitespace = /\s/u.test(textBetweenTokens);
      const hasNewline = hasWhitespace && astUtils.LINEBREAK_MATCHER.test(textBetweenTokens);
      if (option === "never") {
        if (hasWhitespace) {
          return context.report({
            node,
            loc: lastCalleeToken.loc.start,
            messageId: "unexpectedWhitespace",
            fix(fixer) {
              if (!hasNewline && !isOptionalCall) {
                return fixer.removeRange([
                  lastCalleeToken.range[1],
                  openingParenToken.range[0]
                ]);
              }
              return null;
            }
          });
        }
      } else if (isOptionalCall) {
        if (hasWhitespace || hasNewline) {
          context.report({
            node,
            loc: lastCalleeToken.loc.start,
            messageId: "unexpectedWhitespace"
          });
        }
      } else {
        if (!hasWhitespace) {
          context.report({
            node,
            loc: lastCalleeToken.loc.start,
            messageId: "missing",
            fix(fixer) {
              return fixer.insertTextBefore(openingParenToken, " ");
            }
          });
        } else if (!config.allowNewlines && hasNewline) {
          context.report({
            node,
            loc: lastCalleeToken.loc.start,
            messageId: "unexpectedNewline",
            fix(fixer) {
              return fixer.replaceTextRange(
                [lastCalleeToken.range[1], openingParenToken.range[0]],
                " "
              );
            }
          });
        }
      }
    }
    return {
      CallExpression: checkSpacing,
      NewExpression: checkSpacing
    };
  }
});

module.exports = functionCallSpacing;
