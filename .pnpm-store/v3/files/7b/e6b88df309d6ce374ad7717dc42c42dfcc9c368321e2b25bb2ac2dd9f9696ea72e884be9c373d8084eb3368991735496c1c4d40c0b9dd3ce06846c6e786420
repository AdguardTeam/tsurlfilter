'use strict';

require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("object-property-newline");
var objectPropertyNewline = utils.createRule({
  name: "object-property-newline",
  meta: {
    ...baseRule.meta,
    docs: {
      description: "Enforce placing object properties on separate lines"
    }
  },
  defaultOptions: [
    {
      allowAllPropertiesOnSameLine: false,
      allowMultiplePropertiesPerLine: false
    }
  ],
  create(context) {
    const rules = baseRule.create(context);
    return {
      ...rules,
      TSTypeLiteral(node) {
        return rules.ObjectExpression({
          ...node,
          // @ts-expect-error only used to get token and loc
          properties: node.members
        });
      },
      TSInterfaceBody(node) {
        return rules.ObjectExpression({
          ...node,
          // @ts-expect-error only used to get token and loc
          properties: node.body
        });
      }
    };
  }
});

module.exports = objectPropertyNewline;
