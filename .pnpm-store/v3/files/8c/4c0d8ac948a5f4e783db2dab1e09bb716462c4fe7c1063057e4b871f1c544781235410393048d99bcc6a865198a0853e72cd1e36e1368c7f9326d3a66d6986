'use strict';

var estraverse = require('estraverse');

function createRule(rule) {
  return rule;
}

function docsUrl(ruleName) {
  return `https://eslint.style/rules/jsx/${ruleName}`;
}

function traverse(ASTnode, visitor) {
  const opts = Object.assign({}, {
    fallback(node) {
      return Object.keys(node).filter((key) => key === "children" || key === "argument");
    }
  }, visitor);
  opts.keys = Object.assign({}, visitor.keys, {
    JSXElement: ["children"],
    JSXFragment: ["children"]
  });
  estraverse.traverse(ASTnode, opts);
}
function traverseReturns(ASTNode, onReturn) {
  const nodeType = ASTNode.type;
  if (nodeType === "ReturnStatement") {
    onReturn(ASTNode.argument, () => {
    });
    return;
  }
  if (nodeType === "ArrowFunctionExpression" && ASTNode.expression) {
    onReturn(ASTNode.body, () => {
    });
    return;
  }
  if (nodeType !== "FunctionExpression" && nodeType !== "FunctionDeclaration" && nodeType !== "ArrowFunctionExpression" && nodeType !== "MethodDefinition") {
    return;
  }
  traverse(ASTNode.body, {
    enter(node) {
      const breakTraverse = () => {
        this.break();
      };
      switch (node.type) {
        case "ReturnStatement":
          this.skip();
          onReturn(node.argument, breakTraverse);
          return;
        case "BlockStatement":
        case "IfStatement":
        case "ForStatement":
        case "WhileStatement":
        case "SwitchStatement":
        case "SwitchCase":
          return;
        default:
          this.skip();
      }
    }
  });
}
function getFirstNodeInLine(context, node) {
  const sourceCode = context.sourceCode;
  let token = node;
  let lines = null;
  do {
    token = sourceCode.getTokenBefore(token);
    lines = token.type === "JSXText" ? token.value.split("\n") : null;
  } while (token.type === "JSXText" && lines && /^\s*$/.test(lines[lines.length - 1]));
  return token;
}
function isNodeFirstInLine(context, node) {
  const token = getFirstNodeInLine(context, node);
  const startLine = node.loc.start.line;
  const endLine = token ? token.loc.end.line : -1;
  return startLine !== endLine;
}
function isParenthesized(context, node) {
  const sourceCode = context.sourceCode;
  const previousToken = sourceCode.getTokenBefore(node);
  const nextToken = sourceCode.getTokenAfter(node);
  return !!previousToken && !!nextToken && previousToken.value === "(" && previousToken.range[1] <= node.range[0] && nextToken.value === ")" && nextToken.range[0] >= node.range[1];
}

function getVariable(variables, name) {
  return variables.find((variable) => variable.name === name);
}
function variablesInScope(context) {
  let scope = context.getScope();
  let variables = scope.variables;
  while (scope.type !== "global") {
    scope = scope.upper;
    variables = scope.variables.concat(variables);
  }
  if (scope.childScopes.length) {
    variables = scope.childScopes[0].variables.concat(variables);
    if (scope.childScopes[0].childScopes.length)
      variables = scope.childScopes[0].childScopes[0].variables.concat(variables);
  }
  variables.reverse();
  return variables;
}
function findVariableByName(context, name) {
  const variable = getVariable(variablesInScope(context), name);
  if (!variable || !variable.defs[0] || !variable.defs[0].node)
    return null;
  if (variable.defs[0].node.type === "TypeAlias")
    return variable.defs[0].node.right;
  if (variable.defs[0].type === "ImportBinding")
    return variable.defs[0].node;
  return variable.defs[0].node.init;
}

const COMPAT_TAG_REGEX = /^[a-z]/;
function isDOMComponent(node) {
  const name = getElementType(node);
  return COMPAT_TAG_REGEX.test(name);
}
function isJSX(node) {
  return node && ["JSXElement", "JSXFragment"].includes(node.type);
}
function isWhiteSpaces(value) {
  return typeof value === "string" ? /^\s*$/.test(value) : false;
}
function isReturningJSX(ASTnode, context, strict = false, ignoreNull = false) {
  const isJSXValue = (node) => {
    if (!node)
      return false;
    switch (node.type) {
      case "ConditionalExpression":
        if (strict)
          return isJSXValue(node.consequent) && isJSXValue(node.alternate);
        return isJSXValue(node.consequent) || isJSXValue(node.alternate);
      case "LogicalExpression":
        if (strict)
          return isJSXValue(node.left) && isJSXValue(node.right);
        return isJSXValue(node.left) || isJSXValue(node.right);
      case "SequenceExpression":
        return isJSXValue(node.expressions[node.expressions.length - 1]);
      case "JSXElement":
      case "JSXFragment":
        return true;
      case "Literal":
        if (!ignoreNull && node.value === null)
          return true;
        return false;
      case "Identifier": {
        const variable = findVariableByName(context, node.name);
        return isJSX(variable);
      }
      default:
        return false;
    }
  };
  let found = false;
  traverseReturns(
    ASTnode,
    (node, breakTraverse) => {
      if (isJSXValue(node)) {
        found = true;
        breakTraverse();
      }
    }
  );
  return found;
}
function getPropName(prop) {
  if (!prop.type || prop.type !== "JSXAttribute")
    throw new Error("The prop must be a JSXAttribute collected by the AST parser.");
  if (prop.name.type === "JSXNamespacedName")
    return `${prop.name.namespace.name}:${prop.name.name.name}`;
  return prop.name.name;
}
function resolveMemberExpressions(object, property) {
  if (object.type === "JSXMemberExpression")
    return `${resolveMemberExpressions(object.object, object.property)}.${property.name}`;
  return `${object.name}.${property.name}`;
}
function getElementType(node) {
  if (node.type === "JSXOpeningFragment")
    return "<>";
  const { name } = node;
  if (!name)
    throw new Error("The argument provided is not a JSXElement node.");
  if (name.type === "JSXMemberExpression") {
    const { object, property } = name;
    return resolveMemberExpressions(object, property);
  }
  if (name.type === "JSXNamespacedName")
    return `${name.namespace.name}:${name.name.name}`;
  return node.name.name;
}

function getTokenBeforeClosingBracket(node) {
  const attributes = "attributes" in node && node.attributes;
  if (!attributes || attributes.length === 0)
    return node.name;
  return attributes[attributes.length - 1];
}

exports.createRule = createRule;
exports.docsUrl = docsUrl;
exports.getElementType = getElementType;
exports.getFirstNodeInLine = getFirstNodeInLine;
exports.getPropName = getPropName;
exports.getTokenBeforeClosingBracket = getTokenBeforeClosingBracket;
exports.isDOMComponent = isDOMComponent;
exports.isJSX = isJSX;
exports.isNodeFirstInLine = isNodeFirstInLine;
exports.isParenthesized = isParenthesized;
exports.isReturningJSX = isReturningJSX;
exports.isWhiteSpaces = isWhiteSpaces;
