'use strict';

var utils$1 = require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("quote-props");
var quoteProps = utils.createRule({
  name: "quote-props",
  meta: {
    ...baseRule.meta,
    docs: {
      description: "Require quotes around object literal, type literal, interfaces and enums property names"
    }
  },
  defaultOptions: ["always"],
  create(context) {
    const rules = baseRule.create(context);
    return {
      ...rules,
      TSPropertySignature(node) {
        return rules.Property({
          ...node,
          type: utils$1.AST_NODE_TYPES.Property,
          shorthand: false,
          method: false,
          kind: "init",
          value: null
        });
      },
      TSMethodSignature(node) {
        return rules.Property({
          ...node,
          type: utils$1.AST_NODE_TYPES.Property,
          shorthand: false,
          method: true,
          kind: "init",
          value: null
        });
      },
      TSEnumMember(node) {
        return rules.Property({
          ...node,
          type: utils$1.AST_NODE_TYPES.Property,
          key: node.id,
          optional: false,
          shorthand: false,
          method: false,
          kind: "init",
          value: null
        });
      },
      TSTypeLiteral(node) {
        return rules.ObjectExpression({
          ...node,
          type: utils$1.AST_NODE_TYPES.ObjectExpression,
          properties: node.members
        });
      },
      TSInterfaceBody(node) {
        return rules.ObjectExpression({
          ...node,
          type: utils$1.AST_NODE_TYPES.ObjectExpression,
          properties: node.body
        });
      },
      TSEnumDeclaration(node) {
        const members = node.body?.members || node.members;
        return rules.ObjectExpression({
          ...node,
          type: utils$1.AST_NODE_TYPES.ObjectExpression,
          properties: members.map((member) => ({ ...member, key: member.id }))
        });
      }
    };
  }
});

module.exports = quoteProps;
