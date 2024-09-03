'use strict';

var index = require('./index2.js');

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

var plugin = {
  rules: index.rules
};

const config = {
  rules: {
    "@typescript-eslint/block-spacing": 0,
    "@typescript-eslint/brace-style": 0,
    "@typescript-eslint/comma-dangle": 0,
    "@typescript-eslint/comma-spacing": 0,
    "@typescript-eslint/func-call-spacing": 0,
    "@typescript-eslint/indent": 0,
    "@typescript-eslint/key-spacing": 0,
    "@typescript-eslint/keyword-spacing": 0,
    "@typescript-eslint/lines-around-comment": 0,
    "@typescript-eslint/lines-between-class-members": 0,
    "@typescript-eslint/member-delimiter-style": 0,
    "@typescript-eslint/no-extra-parens": 0,
    "@typescript-eslint/no-extra-semi": 0,
    "@typescript-eslint/object-curly-newline": 0,
    "@typescript-eslint/object-curly-spacing": 0,
    "@typescript-eslint/object-property-newline": 0,
    "@typescript-eslint/padding-line-between-statements": 0,
    "@typescript-eslint/quote-props": 0,
    "@typescript-eslint/quotes": 0,
    "@typescript-eslint/semi": 0,
    "@typescript-eslint/space-before-blocks": 0,
    "@typescript-eslint/space-before-function-paren": 0,
    "@typescript-eslint/space-infix-ops": 0,
    "@typescript-eslint/type-annotation-spacing": 0
  }
};

const configs = {
  "disable-legacy": config,
  "all-flat": createAllConfigs(plugin, "@stylistic/ts", true),
  "all-extends": createAllConfigs(plugin, "@stylistic/ts", false)
};

exports.configs = configs;
exports.plugin = plugin;
