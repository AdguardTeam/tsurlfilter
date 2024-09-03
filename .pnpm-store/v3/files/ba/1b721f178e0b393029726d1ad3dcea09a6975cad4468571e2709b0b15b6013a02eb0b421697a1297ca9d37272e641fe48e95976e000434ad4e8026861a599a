'use strict';

var astUtils = require('@typescript-eslint/utils/ast-utils');
require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("space-before-blocks");
var spaceBeforeBlocks = utils.createRule({
  name: "space-before-blocks",
  meta: {
    type: "layout",
    docs: {
      description: "Enforce consistent spacing before blocks"
    },
    fixable: baseRule.meta.fixable,
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema,
    messages: {
      unexpectedSpace: "Unexpected space before opening brace.",
      missingSpace: "Missing space before opening brace.",
      ...baseRule.meta.messages
    }
  },
  defaultOptions: ["always"],
  create(context, [config]) {
    const rules = baseRule.create(context);
    const sourceCode = context.sourceCode;
    let requireSpace = true;
    if (typeof config === "object")
      requireSpace = config.classes === "always";
    else if (config === "never")
      requireSpace = false;
    function checkPrecedingSpace(node) {
      const precedingToken = sourceCode.getTokenBefore(node);
      if (precedingToken && astUtils.isTokenOnSameLine(precedingToken, node)) {
        const hasSpace = sourceCode.isSpaceBetweenTokens(
          precedingToken,
          node
        );
        if (requireSpace && !hasSpace) {
          context.report({
            node,
            messageId: "missingSpace",
            fix(fixer) {
              return fixer.insertTextBefore(node, " ");
            }
          });
        } else if (!requireSpace && hasSpace) {
          context.report({
            node,
            messageId: "unexpectedSpace",
            fix(fixer) {
              return fixer.removeRange([
                precedingToken.range[1],
                node.range[0]
              ]);
            }
          });
        }
      }
    }
    function checkSpaceAfterEnum(node) {
      const punctuator = sourceCode.getTokenAfter(node.id);
      if (punctuator)
        checkPrecedingSpace(punctuator);
    }
    return {
      ...rules,
      TSEnumDeclaration: checkSpaceAfterEnum,
      TSInterfaceBody: checkPrecedingSpace
    };
  }
});

module.exports = spaceBeforeBlocks;
