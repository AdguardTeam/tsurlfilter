'use strict';

var jsxChildElementSpacing = require('./jsx-child-element-spacing.js');
var jsxClosingBracketLocation = require('./jsx-closing-bracket-location.js');
var jsxClosingTagLocation = require('./jsx-closing-tag-location.js');
var jsxCurlyBracePresence = require('./jsx-curly-brace-presence.js');
var jsxCurlyNewline = require('./jsx-curly-newline.js');
var jsxCurlySpacing = require('./jsx-curly-spacing.js');
var jsxEqualsSpacing = require('./jsx-equals-spacing.js');
var jsxFirstPropNewLine = require('./jsx-first-prop-new-line.js');
var jsxFunctionCallNewline = require('./jsx-function-call-newline.js');
var jsxIndent = require('./jsx-indent.js');
var jsxIndentProps = require('./jsx-indent-props.js');
var jsxMaxPropsPerLine = require('./jsx-max-props-per-line.js');
var jsxNewline = require('./jsx-newline.js');
var jsxOneExpressionPerLine = require('./jsx-one-expression-per-line.js');
var jsxPascalCase = require('./jsx-pascal-case.js');
var jsxPropsNoMultiSpaces = require('./jsx-props-no-multi-spaces.js');
var jsxSelfClosingComp = require('./jsx-self-closing-comp.js');
var jsxSortProps = require('./jsx-sort-props.js');
var jsxTagSpacing = require('./jsx-tag-spacing.js');
var jsxWrapMultilines = require('./jsx-wrap-multilines.js');

function createAllConfigs(plugin, name, flat, filter) {
  const rules = Object.fromEntries(
    Object.entries(plugin.rules).filter(
      ([key, rule]) => (
        // Only include fixable rules
        rule.meta.fixable && !rule.meta.deprecated && key === rule.meta.docs.url.split("/").pop() && (!filter)
      )
    ).map(([key]) => [`${name}/${key}`, 2])
  );
  if (flat) {
    return {
      plugins: {
        [name]: plugin
      },
      rules
    };
  } else {
    return {
      plugins: [name],
      rules
    };
  }
}

var rules = {
  "jsx-child-element-spacing": jsxChildElementSpacing.jsxChildElementSpacing,
  "jsx-closing-bracket-location": jsxClosingBracketLocation.jsxClosingBracketLocation,
  "jsx-closing-tag-location": jsxClosingTagLocation.jsxClosingTagLocation,
  "jsx-curly-brace-presence": jsxCurlyBracePresence.jsxCurlyBracePresence,
  "jsx-curly-newline": jsxCurlyNewline.jsxCurlyNewline,
  "jsx-curly-spacing": jsxCurlySpacing.jsxCurlySpacing,
  "jsx-equals-spacing": jsxEqualsSpacing.jsxEqualsSpacing,
  "jsx-first-prop-new-line": jsxFirstPropNewLine.jsxFirstPropNewLine,
  "jsx-function-call-newline": jsxFunctionCallNewline.jsxFunctionCallNewline,
  "jsx-indent": jsxIndent.jsxIndent,
  "jsx-indent-props": jsxIndentProps.jsxIndentProps,
  "jsx-max-props-per-line": jsxMaxPropsPerLine.jsxMaxPropsPerLine,
  "jsx-newline": jsxNewline.jsxNewline,
  "jsx-one-expression-per-line": jsxOneExpressionPerLine.jsxOneExpressionPerLine,
  "jsx-pascal-case": jsxPascalCase.jsxPascalCase,
  "jsx-props-no-multi-spaces": jsxPropsNoMultiSpaces.jsxPropsNoMultiSpaces,
  "jsx-self-closing-comp": jsxSelfClosingComp.jsxSelfClosingComp,
  "jsx-sort-props": jsxSortProps.jsxSortProps,
  "jsx-tag-spacing": jsxTagSpacing.jsxTagSpacing,
  "jsx-wrap-multilines": jsxWrapMultilines.jsxWrapMultilines
};

var plugin = {
  rules
};

const config = {
  rules: {
    "react/jsx-child-element-spacing": 0,
    "react/jsx-closing-bracket-location": 0,
    "react/jsx-closing-tag-location": 0,
    "react/jsx-curly-brace-presence": 0,
    "react/jsx-curly-newline": 0,
    "react/jsx-curly-spacing": 0,
    "react/jsx-equals-spacing": 0,
    "react/jsx-first-prop-new-line": 0,
    "react/jsx-function-call-newline": 0,
    "react/jsx-indent": 0,
    "react/jsx-indent-props": 0,
    "react/jsx-max-props-per-line": 0,
    "react/jsx-newline": 0,
    "react/jsx-one-expression-per-line": 0,
    "react/jsx-pascal-case": 0,
    "react/jsx-props-no-multi-spaces": 0,
    "react/jsx-self-closing-comp": 0,
    "react/jsx-sort-props": 0,
    "react/jsx-tag-spacing": 0,
    "react/jsx-wrap-multilines": 0
  }
};

const configs = {
  "disable-legacy": config,
  "all-flat": createAllConfigs(plugin, "@stylistic/jsx", true),
  "all-extends": createAllConfigs(plugin, "@stylistic/jsx", false)
};

exports.configs = configs;
exports.plugin = plugin;
