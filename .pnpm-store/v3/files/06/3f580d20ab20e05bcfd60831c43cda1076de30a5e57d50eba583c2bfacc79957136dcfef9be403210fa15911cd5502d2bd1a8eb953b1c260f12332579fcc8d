'use strict';

var utils$1 = require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("quotes");
var quotes = utils.createRule({
  name: "quotes",
  meta: {
    type: "layout",
    docs: {
      description: "Enforce the consistent use of either backticks, double, or single quotes"
    },
    fixable: "code",
    hasSuggestions: baseRule.meta.hasSuggestions,
    messages: baseRule.meta.messages,
    schema: baseRule.meta.schema
  },
  defaultOptions: [
    "double",
    {
      allowTemplateLiterals: false,
      avoidEscape: false,
      ignoreStringLiterals: false
    }
  ],
  create(context, [option]) {
    const rules = baseRule.create(context);
    function isAllowedAsNonBacktick(node) {
      const parent = node.parent;
      switch (parent?.type) {
        case utils$1.AST_NODE_TYPES.TSAbstractMethodDefinition:
        case utils$1.AST_NODE_TYPES.TSMethodSignature:
        case utils$1.AST_NODE_TYPES.TSPropertySignature:
        case utils$1.AST_NODE_TYPES.TSModuleDeclaration:
        case utils$1.AST_NODE_TYPES.TSExternalModuleReference:
          return true;
        case utils$1.AST_NODE_TYPES.TSEnumMember:
          return node === parent.id;
        case utils$1.AST_NODE_TYPES.TSAbstractPropertyDefinition:
        case utils$1.AST_NODE_TYPES.PropertyDefinition:
          return node === parent.key;
        default:
          return false;
      }
    }
    return {
      Literal(node) {
        if (option === "backtick" && isAllowedAsNonBacktick(node))
          return;
        rules.Literal(node);
      },
      TemplateLiteral(node) {
        rules.TemplateLiteral(node);
      }
    };
  }
});

module.exports = quotes;
