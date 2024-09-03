'use strict';

var utils$1 = require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("semi");
var semi = utils.createRule({
  name: "semi",
  meta: {
    type: "layout",
    docs: {
      description: "Require or disallow semicolons instead of ASI"
      // too opinionated to be recommended
    },
    fixable: "code",
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema,
    messages: baseRule.meta.messages
  },
  defaultOptions: [
    "always",
    {
      omitLastInOneLineBlock: false,
      beforeStatementContinuationChars: "any"
    }
  ],
  create(context) {
    const rules = baseRule.create(context);
    const checkForSemicolon = rules.ExpressionStatement;
    const nodesToCheck = [
      utils$1.AST_NODE_TYPES.PropertyDefinition,
      utils$1.AST_NODE_TYPES.TSAbstractPropertyDefinition,
      utils$1.AST_NODE_TYPES.TSDeclareFunction,
      utils$1.AST_NODE_TYPES.TSExportAssignment,
      utils$1.AST_NODE_TYPES.TSImportEqualsDeclaration,
      utils$1.AST_NODE_TYPES.TSTypeAliasDeclaration,
      utils$1.AST_NODE_TYPES.TSEmptyBodyFunctionExpression
    ].reduce((acc, node) => {
      acc[node] = checkForSemicolon;
      return acc;
    }, {});
    return {
      ...rules,
      ...nodesToCheck,
      ExportDefaultDeclaration(node) {
        if (node.declaration.type !== utils$1.AST_NODE_TYPES.TSInterfaceDeclaration)
          rules.ExportDefaultDeclaration(node);
      }
    };
  }
});

module.exports = semi;
