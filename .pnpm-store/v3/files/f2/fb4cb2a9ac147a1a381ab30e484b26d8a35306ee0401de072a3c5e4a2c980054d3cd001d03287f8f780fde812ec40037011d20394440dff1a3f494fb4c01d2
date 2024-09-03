'use strict';

var utils$1 = require('@typescript-eslint/utils');
var astUtils = require('@typescript-eslint/utils/ast-utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("space-infix-ops");
const UNIONS = ["|", "&"];
var spaceInfixOps = utils.createRule({
  name: "space-infix-ops",
  meta: {
    type: "layout",
    docs: {
      description: "Require spacing around infix operators"
    },
    fixable: baseRule.meta.fixable,
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema,
    messages: {
      missingSpace: "Operator '{{operator}}' must be spaced.",
      ...baseRule.meta.messages
    }
  },
  defaultOptions: [
    {
      int32Hint: false
    }
  ],
  create(context) {
    const rules = baseRule.create(context);
    const sourceCode = context.sourceCode;
    function report(operator) {
      context.report({
        node: operator,
        messageId: "missingSpace",
        data: {
          operator: operator.value
        },
        fix(fixer) {
          const previousToken = sourceCode.getTokenBefore(operator);
          const afterToken = sourceCode.getTokenAfter(operator);
          let fixString = "";
          if (operator.range[0] - previousToken.range[1] === 0)
            fixString = " ";
          fixString += operator.value;
          if (afterToken.range[0] - operator.range[1] === 0)
            fixString += " ";
          return fixer.replaceText(operator, fixString);
        }
      });
    }
    function isSpaceChar(token) {
      return token.type === utils$1.AST_TOKEN_TYPES.Punctuator && /^[=?:]$/.test(token.value);
    }
    function checkAndReportAssignmentSpace(leftNode, rightNode) {
      if (!rightNode || !leftNode)
        return;
      const operator = sourceCode.getFirstTokenBetween(
        leftNode,
        rightNode,
        isSpaceChar
      );
      const prev = sourceCode.getTokenBefore(operator);
      const next = sourceCode.getTokenAfter(operator);
      if (!sourceCode.isSpaceBetween(prev, operator) || !sourceCode.isSpaceBetween(operator, next)) {
        report(operator);
      }
    }
    function checkForEnumAssignmentSpace(node) {
      checkAndReportAssignmentSpace(node.id, node.initializer);
    }
    function checkForPropertyDefinitionAssignmentSpace(node) {
      const leftNode = node.optional && !node.typeAnnotation ? sourceCode.getTokenAfter(node.key) : node.typeAnnotation ?? node.key;
      checkAndReportAssignmentSpace(leftNode, node.value);
    }
    function checkForTypeAnnotationSpace(typeAnnotation) {
      const types = typeAnnotation.types;
      types.forEach((type) => {
        const skipFunctionParenthesis = type.type === utils$1.AST_NODE_TYPES.TSFunctionType ? astUtils.isNotOpeningParenToken : 0;
        const operator = sourceCode.getTokenBefore(
          type,
          skipFunctionParenthesis
        );
        if (operator != null && UNIONS.includes(operator.value)) {
          const prev = sourceCode.getTokenBefore(operator);
          const next = sourceCode.getTokenAfter(operator);
          if (!sourceCode.isSpaceBetween(prev, operator) || !sourceCode.isSpaceBetween(operator, next)) {
            report(operator);
          }
        }
      });
    }
    function checkForTypeAliasAssignment(node) {
      checkAndReportAssignmentSpace(
        node.typeParameters ?? node.id,
        node.typeAnnotation
      );
    }
    function checkForTypeConditional(node) {
      checkAndReportAssignmentSpace(node.extendsType, node.trueType);
      checkAndReportAssignmentSpace(node.trueType, node.falseType);
    }
    return {
      ...rules,
      TSEnumMember: checkForEnumAssignmentSpace,
      PropertyDefinition: checkForPropertyDefinitionAssignmentSpace,
      TSTypeAliasDeclaration: checkForTypeAliasAssignment,
      TSUnionType: checkForTypeAnnotationSpace,
      TSIntersectionType: checkForTypeAnnotationSpace,
      TSConditionalType: checkForTypeConditional
    };
  }
});

module.exports = spaceInfixOps;
