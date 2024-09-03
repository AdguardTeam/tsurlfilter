'use strict';

var utils$1 = require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("keyword-spacing");
const baseSchema = Array.isArray(baseRule.meta.schema) ? baseRule.meta.schema[0] : baseRule.meta.schema;
const schema = utils.deepMerge(
  baseSchema,
  {
    properties: {
      overrides: {
        properties: {
          type: baseSchema.properties.overrides.properties.import
        }
      }
    }
  }
);
var keywordSpacing = utils.createRule({
  name: "keyword-spacing",
  meta: {
    type: "layout",
    docs: {
      description: "Enforce consistent spacing before and after keywords"
    },
    fixable: "whitespace",
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: [schema],
    messages: baseRule.meta.messages
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const { after, overrides } = options ?? {};
    const sourceCode = context.sourceCode;
    const baseRules = baseRule.create(context);
    return {
      ...baseRules,
      TSAsExpression(node) {
        const asToken = utils.nullThrows(
          sourceCode.getTokenAfter(
            node.expression,
            (token) => token.value === "as"
          ),
          utils.NullThrowsReasons.MissingToken("as", node.type)
        );
        const oldTokenType = asToken.type;
        asToken.type = utils$1.AST_TOKEN_TYPES.Keyword;
        baseRules.DebuggerStatement(asToken);
        asToken.type = oldTokenType;
      },
      "ImportDeclaration[importKind=type]": function(node) {
        const { type: typeOptionOverride = {} } = overrides ?? {};
        const typeToken = sourceCode.getFirstToken(node, { skip: 1 });
        const punctuatorToken = sourceCode.getTokenAfter(typeToken);
        if (node.specifiers?.[0]?.type === utils$1.AST_NODE_TYPES.ImportDefaultSpecifier)
          return;
        const spacesBetweenTypeAndPunctuator = punctuatorToken.range[0] - typeToken.range[1];
        if ((typeOptionOverride.after ?? after) === true && spacesBetweenTypeAndPunctuator === 0) {
          context.report({
            loc: typeToken.loc,
            messageId: "expectedAfter",
            data: { value: "type" },
            fix(fixer) {
              return fixer.insertTextAfter(typeToken, " ");
            }
          });
        }
        if ((typeOptionOverride.after ?? after) === false && spacesBetweenTypeAndPunctuator > 0) {
          context.report({
            loc: typeToken.loc,
            messageId: "unexpectedAfter",
            data: { value: "type" },
            fix(fixer) {
              return fixer.removeRange([
                typeToken.range[1],
                typeToken.range[1] + spacesBetweenTypeAndPunctuator
              ]);
            }
          });
        }
      }
    };
  }
});

module.exports = keywordSpacing;
