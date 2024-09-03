'use strict';

var astUtils = require('@typescript-eslint/utils/ast-utils');
require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("brace-style");
var braceStyle = utils.createRule({
  name: "brace-style",
  meta: {
    type: "layout",
    docs: {
      description: "Enforce consistent brace style for blocks"
    },
    messages: baseRule.meta.messages,
    fixable: baseRule.meta.fixable,
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema
  },
  defaultOptions: ["1tbs"],
  create(context) {
    const [style, { allowSingleLine } = { allowSingleLine: false }] = context.options;
    const isAllmanStyle = style === "allman";
    const sourceCode = context.sourceCode;
    const rules = baseRule.create(context);
    function validateCurlyPair(openingCurlyToken, closingCurlyToken) {
      if (allowSingleLine && astUtils.isTokenOnSameLine(openingCurlyToken, closingCurlyToken)) {
        return;
      }
      const tokenBeforeOpeningCurly = sourceCode.getTokenBefore(openingCurlyToken);
      const tokenBeforeClosingCurly = sourceCode.getTokenBefore(closingCurlyToken);
      const tokenAfterOpeningCurly = sourceCode.getTokenAfter(openingCurlyToken);
      if (!isAllmanStyle && !astUtils.isTokenOnSameLine(tokenBeforeOpeningCurly, openingCurlyToken)) {
        context.report({
          node: openingCurlyToken,
          messageId: "nextLineOpen",
          fix: (fixer) => {
            const textRange = [
              tokenBeforeOpeningCurly.range[1],
              openingCurlyToken.range[0]
            ];
            const textBetween = sourceCode.text.slice(
              textRange[0],
              textRange[1]
            );
            if (textBetween.trim())
              return null;
            return fixer.replaceTextRange(textRange, " ");
          }
        });
      }
      if (isAllmanStyle && astUtils.isTokenOnSameLine(tokenBeforeOpeningCurly, openingCurlyToken)) {
        context.report({
          node: openingCurlyToken,
          messageId: "sameLineOpen",
          fix: (fixer) => fixer.insertTextBefore(openingCurlyToken, "\n")
        });
      }
      if (astUtils.isTokenOnSameLine(openingCurlyToken, tokenAfterOpeningCurly) && tokenAfterOpeningCurly !== closingCurlyToken) {
        context.report({
          node: openingCurlyToken,
          messageId: "blockSameLine",
          fix: (fixer) => fixer.insertTextAfter(openingCurlyToken, "\n")
        });
      }
      if (astUtils.isTokenOnSameLine(tokenBeforeClosingCurly, closingCurlyToken) && tokenBeforeClosingCurly !== openingCurlyToken) {
        context.report({
          node: closingCurlyToken,
          messageId: "singleLineClose",
          fix: (fixer) => fixer.insertTextBefore(closingCurlyToken, "\n")
        });
      }
    }
    return {
      ...rules,
      "TSInterfaceBody, TSModuleBlock": function(node) {
        const openingCurly = sourceCode.getFirstToken(node);
        const closingCurly = sourceCode.getLastToken(node);
        validateCurlyPair(openingCurly, closingCurly);
      },
      TSEnumDeclaration(node) {
        const closingCurly = sourceCode.getLastToken(node);
        const members = node.body?.members || node.members;
        const openingCurly = sourceCode.getTokenBefore(
          members.length ? members[0] : closingCurly
        );
        validateCurlyPair(openingCurly, closingCurly);
      }
    };
  }
});

module.exports = braceStyle;
