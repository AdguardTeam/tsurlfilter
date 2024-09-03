'use strict';

var utils$1 = require('@typescript-eslint/utils');
var astUtils = require('@typescript-eslint/utils/ast-utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("no-extra-parens");
var noExtraParens = utils.createRule({
  name: "no-extra-parens",
  meta: {
    type: "layout",
    docs: {
      description: "Disallow unnecessary parentheses"
    },
    fixable: "code",
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema,
    messages: baseRule.meta.messages
  },
  defaultOptions: ["all"],
  create(context) {
    const sourceCode = context.sourceCode;
    const rules = baseRule.create(context);
    function binaryExp(node) {
      const rule = rules.BinaryExpression;
      const isLeftTypeAssertion = astUtils.isTypeAssertion(node.left);
      const isRightTypeAssertion = astUtils.isTypeAssertion(node.right);
      if (isLeftTypeAssertion && isRightTypeAssertion)
        return;
      if (isLeftTypeAssertion) {
        return rule({
          ...node,
          left: {
            ...node.left,
            type: utils$1.AST_NODE_TYPES.SequenceExpression
          }
        });
      }
      if (isRightTypeAssertion) {
        return rule({
          ...node,
          right: {
            ...node.right,
            type: utils$1.AST_NODE_TYPES.SequenceExpression
          }
        });
      }
      return rule(node);
    }
    function callExp(node) {
      const rule = rules.CallExpression;
      if (astUtils.isTypeAssertion(node.callee)) {
        return rule({
          ...node,
          callee: {
            ...node.callee,
            type: utils$1.AST_NODE_TYPES.SequenceExpression
          }
        });
      }
      if (node.arguments.length === 1 && sourceCode.getTokenAfter(node.callee, astUtils.isOpeningParenToken) !== sourceCode.getTokenBefore(node.arguments[0], astUtils.isOpeningParenToken)) {
        return rule({
          ...node,
          arguments: [
            {
              ...node.arguments[0],
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          ]
        });
      }
      return rule(node);
    }
    function unaryUpdateExpression(node) {
      const rule = rules.UnaryExpression;
      if (astUtils.isTypeAssertion(node.argument)) {
        return rule({
          ...node,
          argument: {
            ...node.argument,
            type: utils$1.AST_NODE_TYPES.SequenceExpression
          }
        });
      }
      return rule(node);
    }
    const overrides = {
      ArrayExpression(node) {
        node.elements.forEach((element, index) => {
          if (astUtils.isTypeAssertion(element)) {
            return rules.ArrayExpression({
              ...node,
              elements: [
                ...node.elements.slice(0, index),
                {
                  ...element,
                  type: utils$1.AST_NODE_TYPES.FunctionExpression
                },
                ...node.elements.slice(index + 1)
              ]
            });
          }
        });
      },
      ArrowFunctionExpression(node) {
        if (!astUtils.isTypeAssertion(node.body))
          return rules.ArrowFunctionExpression(node);
      },
      // AssignmentExpression
      AwaitExpression(node) {
        if (astUtils.isTypeAssertion(node.argument)) {
          return rules.AwaitExpression({
            ...node,
            argument: {
              ...node.argument,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        return rules.AwaitExpression(node);
      },
      "BinaryExpression": binaryExp,
      "CallExpression": callExp,
      ClassDeclaration(node) {
        if (node.superClass?.type === utils$1.AST_NODE_TYPES.TSAsExpression) {
          return rules.ClassDeclaration({
            ...node,
            superClass: {
              ...node.superClass,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        return rules.ClassDeclaration(node);
      },
      ClassExpression(node) {
        if (node.superClass?.type === utils$1.AST_NODE_TYPES.TSAsExpression) {
          return rules.ClassExpression({
            ...node,
            superClass: {
              ...node.superClass,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        return rules.ClassExpression(node);
      },
      ConditionalExpression(node) {
        if (astUtils.isTypeAssertion(node.test)) {
          return rules.ConditionalExpression({
            ...node,
            test: {
              ...node.test,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        if (astUtils.isTypeAssertion(node.consequent)) {
          return rules.ConditionalExpression({
            ...node,
            consequent: {
              ...node.consequent,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        if (astUtils.isTypeAssertion(node.alternate)) {
          return rules.ConditionalExpression({
            ...node,
            alternate: {
              ...node.alternate,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        return rules.ConditionalExpression(node);
      },
      // DoWhileStatement
      // ForIn and ForOf are guarded by eslint version
      ForStatement(node) {
        if (node.init && astUtils.isTypeAssertion(node.init)) {
          return rules.ForStatement({
            ...node,
            init: null
          });
        }
        if (node.test && astUtils.isTypeAssertion(node.test)) {
          return rules.ForStatement({
            ...node,
            test: null
          });
        }
        if (node.update && astUtils.isTypeAssertion(node.update)) {
          return rules.ForStatement({
            ...node,
            update: null
          });
        }
        return rules.ForStatement(node);
      },
      "ForStatement > *.init:exit": function(node) {
        if (!astUtils.isTypeAssertion(node))
          return rules["ForStatement > *.init:exit"](node);
      },
      // IfStatement
      "LogicalExpression": binaryExp,
      MemberExpression(node) {
        if (astUtils.isTypeAssertion(node.object)) {
          return rules.MemberExpression({
            ...node,
            object: {
              ...node.object,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        if (astUtils.isTypeAssertion(node.property)) {
          return rules.MemberExpression({
            ...node,
            property: {
              ...node.property,
              type: utils$1.AST_NODE_TYPES.FunctionExpression
            }
          });
        }
        return rules.MemberExpression(node);
      },
      "NewExpression": callExp,
      // ObjectExpression
      // ReturnStatement
      // SequenceExpression
      SpreadElement(node) {
        if (!astUtils.isTypeAssertion(node.argument))
          return rules.SpreadElement(node);
      },
      SwitchCase(node) {
        if (node.test && !astUtils.isTypeAssertion(node.test))
          return rules.SwitchCase(node);
      },
      // SwitchStatement
      ThrowStatement(node) {
        if (node.argument && !astUtils.isTypeAssertion(node.argument))
          return rules.ThrowStatement(node);
      },
      "UnaryExpression": unaryUpdateExpression,
      "UpdateExpression": unaryUpdateExpression,
      // VariableDeclarator
      VariableDeclarator(node) {
        if (astUtils.isTypeAssertion(node.init)) {
          return rules.VariableDeclarator({
            ...node,
            type: utils$1.AST_NODE_TYPES.VariableDeclarator,
            init: {
              ...node.init,
              type: utils$1.AST_NODE_TYPES.FunctionExpression
            }
          });
        }
        return rules.VariableDeclarator(node);
      },
      // WhileStatement
      // WithStatement - i'm not going to even bother implementing this terrible and never used feature
      YieldExpression(node) {
        if (node.argument && !astUtils.isTypeAssertion(node.argument))
          return rules.YieldExpression(node);
      },
      ForInStatement(node) {
        if (astUtils.isTypeAssertion(node.right)) {
          return;
        }
        return rules.ForInStatement(node);
      },
      ForOfStatement(node) {
        if (astUtils.isTypeAssertion(node.right)) {
          return rules.ForOfStatement({
            ...node,
            type: utils$1.AST_NODE_TYPES.ForOfStatement,
            right: {
              ...node.right,
              type: utils$1.AST_NODE_TYPES.SequenceExpression
            }
          });
        }
        return rules.ForOfStatement(node);
      },
      TSStringKeyword(node) {
        return rules.TSStringKeyword({
          ...node,
          type: utils$1.AST_NODE_TYPES.FunctionExpression
        });
      }
    };
    return Object.assign({}, rules, overrides);
  }
});

module.exports = noExtraParens;
