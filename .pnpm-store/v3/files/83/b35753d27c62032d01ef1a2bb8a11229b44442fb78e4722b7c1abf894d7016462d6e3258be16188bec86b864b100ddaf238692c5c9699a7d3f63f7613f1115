'use strict';

require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("no-extra-semi");
var noExtraSemi = utils.createRule({
  name: "no-extra-semi",
  meta: {
    type: "layout",
    docs: {
      description: "Disallow unnecessary semicolons"
    },
    fixable: "code",
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema,
    messages: baseRule.meta.messages
  },
  defaultOptions: [],
  create(context) {
    const rules = baseRule.create(context);
    return {
      ...rules,
      "TSAbstractMethodDefinition, TSAbstractPropertyDefinition": function(node) {
        rules["MethodDefinition, PropertyDefinition, StaticBlock"]?.(node);
      }
    };
  }
});

module.exports = noExtraSemi;
