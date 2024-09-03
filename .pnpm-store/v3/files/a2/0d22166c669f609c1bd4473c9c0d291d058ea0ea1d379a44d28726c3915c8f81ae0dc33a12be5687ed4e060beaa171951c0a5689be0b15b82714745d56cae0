'use strict';

require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("object-curly-newline");
const defaultOptionValue = { multiline: false, minProperties: Number.POSITIVE_INFINITY, consistent: true };
var objectCurlyNewline = utils.createRule({
  name: "object-curly-newline",
  meta: {
    ...baseRule.meta,
    docs: {
      description: "Enforce consistent line breaks after opening and before closing braces"
    }
  },
  defaultOptions: [
    {
      ObjectExpression: defaultOptionValue,
      ObjectPattern: defaultOptionValue,
      ImportDeclaration: defaultOptionValue,
      ExportDeclaration: defaultOptionValue,
      TSTypeLiteral: defaultOptionValue,
      TSInterfaceBody: defaultOptionValue
    }
  ],
  create(context) {
    const rules = baseRule.create(context);
    return rules;
  }
});

module.exports = objectCurlyNewline;
