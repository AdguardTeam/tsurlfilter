'use strict';

var utils$1 = require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("lines-between-class-members");
const schema = Object.values(
  utils.deepMerge(
    { ...baseRule.meta.schema },
    {
      1: {
        properties: {
          exceptAfterOverload: {
            type: "boolean",
            default: true
          }
        }
      }
    }
  )
);
var linesBetweenClassMembers = utils.createRule({
  name: "lines-between-class-members",
  meta: {
    type: "layout",
    docs: {
      description: "Require or disallow an empty line between class members"
    },
    fixable: "whitespace",
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema,
    messages: baseRule.meta.messages
  },
  defaultOptions: [
    "always",
    {
      exceptAfterOverload: true,
      exceptAfterSingleLine: false
    }
  ],
  create(context, [firstOption, secondOption]) {
    const rules = baseRule.create(context);
    const exceptAfterOverload = secondOption?.exceptAfterOverload && firstOption === "always";
    function isOverload(node) {
      return (node.type === utils$1.AST_NODE_TYPES.TSAbstractMethodDefinition || node.type === utils$1.AST_NODE_TYPES.MethodDefinition) && node.value.type === utils$1.AST_NODE_TYPES.TSEmptyBodyFunctionExpression;
    }
    return {
      ClassBody(node) {
        const body = exceptAfterOverload ? node.body.filter((node2) => !isOverload(node2)) : node.body;
        rules.ClassBody({ ...node, body });
      }
    };
  }
});

module.exports = linesBetweenClassMembers;
