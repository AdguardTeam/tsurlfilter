'use strict';

var utils$1 = require('@typescript-eslint/utils');
var astUtils = require('@typescript-eslint/utils/ast-utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("comma-dangle");
const OPTION_VALUE_SCHEME = [
  "always-multiline",
  "always",
  "never",
  "only-multiline"
];
const DEFAULT_OPTION_VALUE = "never";
function normalizeOptions(options = {}) {
  if (typeof options === "string") {
    return {
      enums: options,
      generics: options,
      tuples: options
    };
  }
  return {
    enums: options.enums ?? DEFAULT_OPTION_VALUE,
    generics: options.generics ?? DEFAULT_OPTION_VALUE,
    tuples: options.tuples ?? DEFAULT_OPTION_VALUE
  };
}
var commaDangle = utils.createRule({
  name: "comma-dangle",
  meta: {
    type: "layout",
    docs: {
      description: "Require or disallow trailing commas"
    },
    schema: {
      $defs: {
        value: {
          type: "string",
          enum: OPTION_VALUE_SCHEME
        },
        valueWithIgnore: {
          type: "string",
          enum: [...OPTION_VALUE_SCHEME, "ignore"]
        }
      },
      type: "array",
      items: [
        {
          oneOf: [
            {
              $ref: "#/$defs/value"
            },
            {
              type: "object",
              properties: {
                arrays: { $ref: "#/$defs/valueWithIgnore" },
                objects: { $ref: "#/$defs/valueWithIgnore" },
                imports: { $ref: "#/$defs/valueWithIgnore" },
                exports: { $ref: "#/$defs/valueWithIgnore" },
                functions: { $ref: "#/$defs/valueWithIgnore" },
                enums: { $ref: "#/$defs/valueWithIgnore" },
                generics: { $ref: "#/$defs/valueWithIgnore" },
                tuples: { $ref: "#/$defs/valueWithIgnore" }
              },
              additionalProperties: false
            }
          ]
        }
      ],
      additionalItems: false
    },
    fixable: "code",
    hasSuggestions: baseRule.meta.hasSuggestions,
    messages: baseRule.meta.messages
  },
  defaultOptions: ["never"],
  create(context, [options]) {
    const rules = baseRule.create(context);
    const sourceCode = context.sourceCode;
    const normalizedOptions = normalizeOptions(options);
    const isTSX = context.parserOptions?.ecmaFeatures?.jsx && context.filename?.endsWith(".tsx");
    const predicate = {
      "always": forceComma,
      "always-multiline": forceCommaIfMultiline,
      "only-multiline": allowCommaIfMultiline,
      "never": forbidComma,
      // https://github.com/typescript-eslint/typescript-eslint/issues/7220
      "ignore": () => {
      }
    };
    function last(nodes) {
      return nodes[nodes.length - 1] ?? null;
    }
    function getLastItem(node) {
      switch (node.type) {
        case utils$1.AST_NODE_TYPES.TSEnumDeclaration:
          return last(node.body?.members || node.members);
        case utils$1.AST_NODE_TYPES.TSTypeParameterDeclaration:
          return last(node.params);
        case utils$1.AST_NODE_TYPES.TSTupleType:
          return last(node.elementTypes);
        default:
          return null;
      }
    }
    function getTrailingToken(node) {
      const last2 = getLastItem(node);
      const trailing = last2 && sourceCode.getTokenAfter(last2);
      return trailing;
    }
    function isMultiline(node) {
      const last2 = getLastItem(node);
      const lastToken = sourceCode.getLastToken(node);
      return last2?.loc.end.line !== lastToken?.loc.end.line;
    }
    function forbidComma(node) {
      if (isTSX && node.type === utils$1.AST_NODE_TYPES.TSTypeParameterDeclaration && node.params.length === 1)
        return;
      const last2 = getLastItem(node);
      const trailing = getTrailingToken(node);
      if (last2 && trailing && astUtils.isCommaToken(trailing)) {
        context.report({
          node,
          messageId: "unexpected",
          fix(fixer) {
            return fixer.remove(trailing);
          }
        });
      }
    }
    function forceComma(node) {
      const last2 = getLastItem(node);
      const trailing = getTrailingToken(node);
      if (last2 && trailing && !astUtils.isCommaToken(trailing)) {
        context.report({
          node,
          messageId: "missing",
          fix(fixer) {
            return fixer.insertTextAfter(last2, ",");
          }
        });
      }
    }
    function allowCommaIfMultiline(node) {
      if (!isMultiline(node))
        forbidComma(node);
    }
    function forceCommaIfMultiline(node) {
      if (isMultiline(node))
        forceComma(node);
      else
        forbidComma(node);
    }
    return {
      ...rules,
      TSEnumDeclaration: predicate[normalizedOptions.enums],
      TSTypeParameterDeclaration: predicate[normalizedOptions.generics],
      TSTupleType: predicate[normalizedOptions.tuples]
    };
  }
});

module.exports = commaDangle;
