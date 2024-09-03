'use strict';

var utils$1 = require('@typescript-eslint/utils');
var utils = require('./utils.js');
require('@stylistic/eslint-plugin-js');

const baseRule = utils.getESLintCoreRule("indent");
const KNOWN_NODES = /* @__PURE__ */ new Set([
  // Class properties aren't yet supported by eslint...
  utils$1.AST_NODE_TYPES.PropertyDefinition,
  // ts keywords
  utils$1.AST_NODE_TYPES.TSAbstractKeyword,
  utils$1.AST_NODE_TYPES.TSAnyKeyword,
  utils$1.AST_NODE_TYPES.TSBooleanKeyword,
  utils$1.AST_NODE_TYPES.TSNeverKeyword,
  utils$1.AST_NODE_TYPES.TSNumberKeyword,
  utils$1.AST_NODE_TYPES.TSStringKeyword,
  utils$1.AST_NODE_TYPES.TSSymbolKeyword,
  utils$1.AST_NODE_TYPES.TSUndefinedKeyword,
  utils$1.AST_NODE_TYPES.TSUnknownKeyword,
  utils$1.AST_NODE_TYPES.TSVoidKeyword,
  utils$1.AST_NODE_TYPES.TSNullKeyword,
  // ts specific nodes we want to support
  utils$1.AST_NODE_TYPES.TSAbstractPropertyDefinition,
  utils$1.AST_NODE_TYPES.TSAbstractMethodDefinition,
  utils$1.AST_NODE_TYPES.TSArrayType,
  utils$1.AST_NODE_TYPES.TSAsExpression,
  utils$1.AST_NODE_TYPES.TSCallSignatureDeclaration,
  utils$1.AST_NODE_TYPES.TSConditionalType,
  utils$1.AST_NODE_TYPES.TSConstructorType,
  utils$1.AST_NODE_TYPES.TSConstructSignatureDeclaration,
  utils$1.AST_NODE_TYPES.TSDeclareFunction,
  utils$1.AST_NODE_TYPES.TSEmptyBodyFunctionExpression,
  utils$1.AST_NODE_TYPES.TSEnumDeclaration,
  utils$1.AST_NODE_TYPES.TSEnumMember,
  utils$1.AST_NODE_TYPES.TSExportAssignment,
  utils$1.AST_NODE_TYPES.TSExternalModuleReference,
  utils$1.AST_NODE_TYPES.TSFunctionType,
  utils$1.AST_NODE_TYPES.TSImportType,
  utils$1.AST_NODE_TYPES.TSIndexedAccessType,
  utils$1.AST_NODE_TYPES.TSIndexSignature,
  utils$1.AST_NODE_TYPES.TSInferType,
  utils$1.AST_NODE_TYPES.TSInterfaceBody,
  utils$1.AST_NODE_TYPES.TSInterfaceDeclaration,
  utils$1.AST_NODE_TYPES.TSInterfaceHeritage,
  utils$1.AST_NODE_TYPES.TSImportEqualsDeclaration,
  utils$1.AST_NODE_TYPES.TSLiteralType,
  utils$1.AST_NODE_TYPES.TSMappedType,
  utils$1.AST_NODE_TYPES.TSMethodSignature,
  "TSMinusToken",
  utils$1.AST_NODE_TYPES.TSModuleBlock,
  utils$1.AST_NODE_TYPES.TSModuleDeclaration,
  utils$1.AST_NODE_TYPES.TSNonNullExpression,
  utils$1.AST_NODE_TYPES.TSParameterProperty,
  "TSPlusToken",
  utils$1.AST_NODE_TYPES.TSPropertySignature,
  utils$1.AST_NODE_TYPES.TSQualifiedName,
  "TSQuestionToken",
  utils$1.AST_NODE_TYPES.TSRestType,
  utils$1.AST_NODE_TYPES.TSThisType,
  utils$1.AST_NODE_TYPES.TSTupleType,
  utils$1.AST_NODE_TYPES.TSTypeAnnotation,
  utils$1.AST_NODE_TYPES.TSTypeLiteral,
  utils$1.AST_NODE_TYPES.TSTypeOperator,
  utils$1.AST_NODE_TYPES.TSTypeParameter,
  utils$1.AST_NODE_TYPES.TSTypeParameterDeclaration,
  utils$1.AST_NODE_TYPES.TSTypeParameterInstantiation,
  utils$1.AST_NODE_TYPES.TSTypeReference,
  utils$1.AST_NODE_TYPES.Decorator
  // These are took care by `indent-binary-ops` rule
  // AST_NODE_TYPES.TSIntersectionType,
  // AST_NODE_TYPES.TSUnionType,
]);
var indent = utils.createRule({
  name: "indent",
  meta: {
    type: "layout",
    docs: {
      description: "Enforce consistent indentation"
      // too opinionated to be recommended
    },
    fixable: "whitespace",
    hasSuggestions: baseRule.meta.hasSuggestions,
    schema: baseRule.meta.schema,
    messages: baseRule.meta.messages
  },
  defaultOptions: [
    // typescript docs and playground use 4 space indent
    4,
    {
      // typescript docs indent the case from the switch
      // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-8.html#example-4
      SwitchCase: 1,
      flatTernaryExpressions: false,
      ignoredNodes: []
    }
  ],
  create(context, optionsWithDefaults) {
    const contextWithDefaults = Object.create(context, {
      options: {
        writable: false,
        configurable: false,
        value: optionsWithDefaults
      }
    });
    const rules = baseRule.create(contextWithDefaults);
    function TSPropertySignatureToProperty(node, type = utils$1.AST_NODE_TYPES.Property) {
      const base = {
        // indent doesn't actually use these
        key: null,
        value: null,
        // Property flags
        computed: false,
        method: false,
        kind: "init",
        // this will stop eslint from interrogating the type literal
        shorthand: true,
        // location data
        parent: node.parent,
        range: node.range,
        loc: node.loc
      };
      if (type === utils$1.AST_NODE_TYPES.Property) {
        return {
          ...base,
          type
        };
      }
      return {
        type,
        accessibility: void 0,
        declare: false,
        decorators: [],
        definite: false,
        optional: false,
        override: false,
        readonly: false,
        static: false,
        typeAnnotation: void 0,
        ...base
      };
    }
    return {
      ...rules,
      // overwrite the base rule here so we can use our KNOWN_NODES list instead
      "*:exit": function(node) {
        if (!KNOWN_NODES.has(node.type))
          rules["*:exit"](node);
      },
      PropertyDefinition(node) {
        if (node.parent.type !== utils$1.AST_NODE_TYPES.ClassBody || !node.decorators?.length || node.loc.start.line === node.loc.end.line)
          return rules.PropertyDefinition(node);
        let startDecorator = node.decorators[0];
        let endDecorator = startDecorator;
        for (let i = 1; i <= node.decorators.length; i++) {
          const decorator = node.decorators[i];
          if (i === node.decorators.length || startDecorator.loc.start.line !== decorator.loc.start.line) {
            rules.PropertyDefinition({
              type: utils$1.AST_NODE_TYPES.PropertyDefinition,
              key: node.key,
              parent: node.parent,
              range: [startDecorator.range[0], endDecorator.range[1]],
              loc: {
                start: startDecorator.loc.start,
                end: endDecorator.loc.end
              }
            });
            if (decorator)
              startDecorator = endDecorator = decorator;
          } else {
            endDecorator = decorator;
          }
        }
        return rules.PropertyDefinition({
          ...node,
          range: [endDecorator.range[1] + 1, node.range[1]],
          loc: {
            start: node.key.loc.start,
            end: node.loc.end
          }
        });
      },
      VariableDeclaration(node) {
        if (node.declarations.length === 0)
          return;
        return rules.VariableDeclaration(node);
      },
      TSAsExpression(node) {
        return rules["BinaryExpression, LogicalExpression"]({
          type: utils$1.AST_NODE_TYPES.BinaryExpression,
          operator: "as",
          left: node.expression,
          // the first typeAnnotation includes the as token
          right: node.typeAnnotation,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSConditionalType(node) {
        return rules.ConditionalExpression({
          type: utils$1.AST_NODE_TYPES.ConditionalExpression,
          test: {
            parent: node,
            type: utils$1.AST_NODE_TYPES.BinaryExpression,
            operator: "extends",
            left: node.checkType,
            right: node.extendsType,
            // location data
            range: [node.checkType.range[0], node.extendsType.range[1]],
            loc: {
              start: node.checkType.loc.start,
              end: node.extendsType.loc.end
            }
          },
          consequent: node.trueType,
          alternate: node.falseType,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      "TSEnumDeclaration, TSTypeLiteral": function(node) {
        const members = "body" in node ? node.body?.members || node.members : node.members;
        return rules["ObjectExpression, ObjectPattern"]({
          type: utils$1.AST_NODE_TYPES.ObjectExpression,
          properties: members.map(
            (member) => TSPropertySignatureToProperty(member)
          ),
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSImportEqualsDeclaration(node) {
        const { id, moduleReference } = node;
        return rules.VariableDeclaration({
          type: utils$1.AST_NODE_TYPES.VariableDeclaration,
          kind: "const",
          declarations: [
            {
              type: utils$1.AST_NODE_TYPES.VariableDeclarator,
              range: [id.range[0], moduleReference.range[1]],
              loc: {
                start: id.loc.start,
                end: moduleReference.loc.end
              },
              id,
              init: {
                type: utils$1.AST_NODE_TYPES.CallExpression,
                callee: {
                  type: utils$1.AST_NODE_TYPES.Identifier,
                  name: "require",
                  range: [
                    moduleReference.range[0],
                    moduleReference.range[0] + "require".length
                  ],
                  loc: {
                    start: moduleReference.loc.start,
                    end: {
                      line: moduleReference.loc.end.line,
                      column: moduleReference.loc.start.line + "require".length
                    }
                  }
                },
                arguments: "expression" in moduleReference ? [moduleReference.expression] : [],
                // location data
                range: moduleReference.range,
                loc: moduleReference.loc
              }
            }
          ],
          declare: false,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSIndexedAccessType(node) {
        return rules["MemberExpression, JSXMemberExpression, MetaProperty"]({
          type: utils$1.AST_NODE_TYPES.MemberExpression,
          object: node.objectType,
          property: node.indexType,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc,
          optional: false,
          computed: true
        });
      },
      TSInterfaceBody(node) {
        return rules["BlockStatement, ClassBody"]({
          type: utils$1.AST_NODE_TYPES.ClassBody,
          body: node.body.map(
            (p) => TSPropertySignatureToProperty(
              p,
              utils$1.AST_NODE_TYPES.PropertyDefinition
            )
          ),
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      "TSInterfaceDeclaration[extends.length > 0]": function(node) {
        return rules["ClassDeclaration[superClass], ClassExpression[superClass]"](
          {
            type: utils$1.AST_NODE_TYPES.ClassDeclaration,
            body: node.body,
            id: null,
            // TODO: This is invalid, there can be more than one extends in interface
            superClass: node.extends[0].expression,
            abstract: false,
            declare: false,
            decorators: [],
            implements: [],
            superTypeArguments: void 0,
            superTypeParameters: void 0,
            typeParameters: void 0,
            // location data
            parent: node.parent,
            range: node.range,
            loc: node.loc
          }
        );
      },
      TSMappedType(node) {
        const sourceCode = context.sourceCode;
        const squareBracketStart = sourceCode.getTokenBefore(
          node.constraint || node.typeParameter
        );
        return rules["ObjectExpression, ObjectPattern"]({
          type: utils$1.AST_NODE_TYPES.ObjectExpression,
          properties: [
            {
              parent: node,
              type: utils$1.AST_NODE_TYPES.Property,
              key: node.key || node.typeParameter,
              value: node.typeAnnotation,
              // location data
              range: [
                squareBracketStart.range[0],
                node.typeAnnotation ? node.typeAnnotation.range[1] : squareBracketStart.range[0]
              ],
              loc: {
                start: squareBracketStart.loc.start,
                end: node.typeAnnotation ? node.typeAnnotation.loc.end : squareBracketStart.loc.end
              },
              kind: "init",
              computed: false,
              method: false,
              optional: false,
              shorthand: false
            }
          ],
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSModuleBlock(node) {
        return rules["BlockStatement, ClassBody"]({
          type: utils$1.AST_NODE_TYPES.BlockStatement,
          body: node.body,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSQualifiedName(node) {
        return rules["MemberExpression, JSXMemberExpression, MetaProperty"]({
          type: utils$1.AST_NODE_TYPES.MemberExpression,
          object: node.left,
          property: node.right,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc,
          optional: false,
          computed: false
        });
      },
      TSTupleType(node) {
        return rules["ArrayExpression, ArrayPattern"]({
          type: utils$1.AST_NODE_TYPES.ArrayExpression,
          elements: node.elementTypes,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSTypeParameterDeclaration(node) {
        if (!node.params.length)
          return;
        const [name, ...attributes] = node.params;
        return rules.JSXOpeningElement({
          type: utils$1.AST_NODE_TYPES.JSXOpeningElement,
          selfClosing: false,
          name,
          attributes,
          typeArguments: void 0,
          typeParameters: void 0,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      },
      TSTypeParameterInstantiation(node) {
        if (!node.params.length)
          return;
        const [name, ...attributes] = node.params;
        return rules.JSXOpeningElement({
          type: utils$1.AST_NODE_TYPES.JSXOpeningElement,
          selfClosing: false,
          name,
          attributes,
          typeArguments: void 0,
          typeParameters: void 0,
          // location data
          parent: node.parent,
          range: node.range,
          loc: node.loc
        });
      }
    };
  }
});

module.exports = indent;
