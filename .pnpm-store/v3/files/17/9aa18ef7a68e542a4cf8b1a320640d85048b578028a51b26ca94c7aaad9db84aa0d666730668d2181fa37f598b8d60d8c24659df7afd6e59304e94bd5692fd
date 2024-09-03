'use strict';

var js = require('@stylistic/eslint-plugin-js');
var jsx = require('@stylistic/eslint-plugin-jsx');
var ts = require('@stylistic/eslint-plugin-ts');
var plus = require('@stylistic/eslint-plugin-plus');

function createAllConfigs(plugin, name, flat, filter) {
  const rules = Object.fromEntries(
    Object.entries(plugin.rules).filter(
      ([key, rule]) => (
        // Only include fixable rules
        rule.meta.fixable && !rule.meta.deprecated && key === rule.meta.docs.url.split("/").pop() && (!filter || filter(key, rule))
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
  rules: {
    ...js.rules,
    ...jsx.rules,
    ...ts.rules,
    ...plus.rules
  }
};

const config = {
  rules: {
    "array-bracket-newline": 0,
    "array-bracket-spacing": 0,
    "array-element-newline": 0,
    "arrow-parens": 0,
    "arrow-spacing": 0,
    "block-spacing": 0,
    "brace-style": 0,
    "comma-dangle": 0,
    "comma-spacing": 0,
    "comma-style": 0,
    "computed-property-spacing": 0,
    "dot-location": 0,
    "eol-last": 0,
    "func-call-spacing": 0,
    "function-call-argument-newline": 0,
    "function-paren-newline": 0,
    "generator-star-spacing": 0,
    "implicit-arrow-linebreak": 0,
    "indent": 0,
    "jsx-quotes": 0,
    "key-spacing": 0,
    "keyword-spacing": 0,
    "linebreak-style": 0,
    "lines-around-comment": 0,
    "lines-between-class-members": 0,
    "max-len": 0,
    "max-statements-per-line": 0,
    "multiline-ternary": 0,
    "new-parens": 0,
    "newline-per-chained-call": 0,
    "no-confusing-arrow": 0,
    "no-extra-parens": 0,
    "no-extra-semi": 0,
    "no-floating-decimal": 0,
    "no-mixed-operators": 0,
    "no-mixed-spaces-and-tabs": 0,
    "no-multi-spaces": 0,
    "no-multiple-empty-lines": 0,
    "no-tabs": 0,
    "no-trailing-spaces": 0,
    "no-whitespace-before-property": 0,
    "nonblock-statement-body-position": 0,
    "object-curly-newline": 0,
    "object-curly-spacing": 0,
    "object-property-newline": 0,
    "one-var-declaration-per-line": 0,
    "operator-linebreak": 0,
    "padded-blocks": 0,
    "padding-line-between-statements": 0,
    "quote-props": 0,
    "quotes": 0,
    "rest-spread-spacing": 0,
    "semi": 0,
    "semi-spacing": 0,
    "semi-style": 0,
    "space-before-blocks": 0,
    "space-before-function-paren": 0,
    "space-in-parens": 0,
    "space-infix-ops": 0,
    "space-unary-ops": 0,
    "spaced-comment": 0,
    "switch-colon-spacing": 0,
    "template-curly-spacing": 0,
    "template-tag-spacing": 0,
    "wrap-iife": 0,
    "wrap-regex": 0,
    "yield-star-spacing": 0,
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
    "@typescript-eslint/object-curly-spacing": 0,
    "@typescript-eslint/padding-line-between-statements": 0,
    "@typescript-eslint/quotes": 0,
    "@typescript-eslint/semi": 0,
    "@typescript-eslint/space-before-blocks": 0,
    "@typescript-eslint/space-before-function-paren": 0,
    "@typescript-eslint/space-infix-ops": 0,
    "@typescript-eslint/type-annotation-spacing": 0,
    "react/jsx-child-element-spacing": 0,
    "react/jsx-closing-bracket-location": 0,
    "react/jsx-closing-tag-location": 0,
    "react/jsx-curly-brace-presence": 0,
    "react/jsx-curly-newline": 0,
    "react/jsx-curly-spacing": 0,
    "react/jsx-equals-spacing": 0,
    "react/jsx-first-prop-new-line": 0,
    "react/jsx-indent": 0,
    "react/jsx-indent-props": 0,
    "react/jsx-max-props-per-line": 0,
    "react/jsx-newline": 0,
    "react/jsx-one-expression-per-line": 0,
    "react/jsx-props-no-multi-spaces": 0,
    "react/jsx-self-closing-comp": 0,
    "react/jsx-sort-props": 0,
    "react/jsx-tag-spacing": 0,
    "react/jsx-wrap-multilines": 0
  }
};

function customize(options = {}) {
  const {
    arrowParens = false,
    blockSpacing = true,
    braceStyle = "stroustrup",
    commaDangle = "always-multiline",
    flat = true,
    indent = 2,
    jsx = true,
    pluginName = "@stylistic",
    quoteProps = "consistent-as-needed",
    quotes = "single",
    semi = false
  } = options;
  let rules = {
    "@stylistic/array-bracket-spacing": ["error", "never"],
    "@stylistic/arrow-parens": ["error", arrowParens ? "always" : "as-needed", { requireForBlockBody: true }],
    "@stylistic/arrow-spacing": ["error", { after: true, before: true }],
    "@stylistic/block-spacing": ["error", blockSpacing ? "always" : "never"],
    "@stylistic/brace-style": ["error", braceStyle, { allowSingleLine: true }],
    "@stylistic/comma-dangle": ["error", commaDangle],
    "@stylistic/comma-spacing": ["error", { after: true, before: false }],
    "@stylistic/comma-style": ["error", "last"],
    "@stylistic/computed-property-spacing": ["error", "never", { enforceForClassMembers: true }],
    "@stylistic/dot-location": ["error", "property"],
    "@stylistic/eol-last": "error",
    "@stylistic/indent": ["error", indent, {
      ArrayExpression: 1,
      CallExpression: { arguments: 1 },
      flatTernaryExpressions: false,
      FunctionDeclaration: { body: 1, parameters: 1 },
      FunctionExpression: { body: 1, parameters: 1 },
      ignoreComments: false,
      ignoredNodes: [
        "TemplateLiteral *",
        "TSUnionType",
        "TSIntersectionType",
        "TSTypeParameterInstantiation",
        "FunctionExpression > .params[decorators.length > 0]",
        "FunctionExpression > .params > :matches(Decorator, :not(:first-child))"
      ],
      ImportDeclaration: 1,
      MemberExpression: 1,
      ObjectExpression: 1,
      offsetTernaryExpressions: true,
      outerIIFEBody: 1,
      SwitchCase: 1,
      VariableDeclarator: 1
    }],
    "@stylistic/indent-binary-ops": ["error", indent],
    "@stylistic/key-spacing": ["error", { afterColon: true, beforeColon: false }],
    "@stylistic/keyword-spacing": ["error", { after: true, before: true }],
    "@stylistic/lines-between-class-members": ["error", "always", { exceptAfterSingleLine: true }],
    "@stylistic/max-statements-per-line": ["error", { max: 1 }],
    "@stylistic/member-delimiter-style": ["error", {
      multiline: {
        delimiter: semi ? "semi" : "none",
        requireLast: semi
      },
      multilineDetection: "brackets",
      overrides: {
        interface: {
          multiline: {
            delimiter: semi ? "semi" : "none",
            requireLast: semi
          }
        }
      },
      singleline: {
        delimiter: semi ? "semi" : "comma"
      }
    }],
    "@stylistic/multiline-ternary": ["error", "always-multiline"],
    "@stylistic/new-parens": "error",
    "@stylistic/no-extra-parens": ["error", "functions"],
    "@stylistic/no-floating-decimal": "error",
    "@stylistic/no-mixed-operators": ["error", {
      allowSamePrecedence: true,
      groups: [
        ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
        ["&&", "||"],
        ["in", "instanceof"]
      ]
    }],
    "@stylistic/no-mixed-spaces-and-tabs": "error",
    "@stylistic/no-multi-spaces": "error",
    "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }],
    "@stylistic/no-tabs": indent === "tab" ? "off" : "error",
    "@stylistic/no-trailing-spaces": "error",
    "@stylistic/no-whitespace-before-property": "error",
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/operator-linebreak": ["error", "before"],
    "@stylistic/padded-blocks": ["error", { blocks: "never", classes: "never", switches: "never" }],
    "@stylistic/quote-props": ["error", quoteProps],
    "@stylistic/quotes": ["error", quotes, { allowTemplateLiterals: true, avoidEscape: false }],
    "@stylistic/rest-spread-spacing": ["error", "never"],
    "@stylistic/semi": ["error", semi ? "always" : "never"],
    "@stylistic/semi-spacing": ["error", { after: true, before: false }],
    "@stylistic/space-before-blocks": ["error", "always"],
    "@stylistic/space-before-function-paren": ["error", { anonymous: "always", asyncArrow: "always", named: "never" }],
    "@stylistic/space-in-parens": ["error", "never"],
    "@stylistic/space-infix-ops": "error",
    "@stylistic/space-unary-ops": ["error", { nonwords: false, words: true }],
    "@stylistic/spaced-comment": ["error", "always", {
      block: {
        balanced: true,
        exceptions: ["*"],
        markers: ["!"]
      },
      line: {
        exceptions: ["/", "#"],
        markers: ["/"]
      }
    }],
    "@stylistic/template-curly-spacing": "error",
    "@stylistic/template-tag-spacing": ["error", "never"],
    "@stylistic/type-annotation-spacing": ["error", {}],
    "@stylistic/type-generic-spacing": "error",
    "@stylistic/type-named-tuple-spacing": "error",
    "@stylistic/wrap-iife": ["error", "any", { functionPrototypeMethods: true }],
    "@stylistic/yield-star-spacing": ["error", "both"],
    ...jsx ? {
      "@stylistic/jsx-closing-bracket-location": "error",
      "@stylistic/jsx-closing-tag-location": "error",
      "@stylistic/jsx-curly-brace-presence": ["error", { propElementValues: "always" }],
      "@stylistic/jsx-curly-newline": "error",
      "@stylistic/jsx-curly-spacing": ["error", "never"],
      "@stylistic/jsx-equals-spacing": "error",
      "@stylistic/jsx-first-prop-new-line": "error",
      "@stylistic/jsx-function-call-newline": ["error", "multiline"],
      "@stylistic/jsx-indent-props": ["error", indent],
      "@stylistic/jsx-max-props-per-line": ["error", { maximum: 1, when: "multiline" }],
      "@stylistic/jsx-one-expression-per-line": ["error", { allow: "single-child" }],
      "@stylistic/jsx-quotes": "error",
      "@stylistic/jsx-tag-spacing": [
        "error",
        {
          afterOpening: "never",
          beforeClosing: "never",
          beforeSelfClosing: "always",
          closingSlash: "never"
        }
      ],
      "@stylistic/jsx-wrap-multilines": [
        "error",
        {
          arrow: "parens-new-line",
          assignment: "parens-new-line",
          condition: "parens-new-line",
          declaration: "parens-new-line",
          logical: "parens-new-line",
          prop: "parens-new-line",
          propertyValue: "parens-new-line",
          return: "parens-new-line"
        }
      ]
    } : {}
  };
  if (pluginName !== "@stylistic") {
    const regex = /^@stylistic\//;
    rules = Object.fromEntries(
      Object.entries(rules).map(([ruleName, ruleConfig]) => [
        ruleName.replace(regex, `${pluginName}/`),
        ruleConfig
      ])
    );
  }
  if (flat) {
    return {
      plugins: {
        [pluginName]: plugin
      },
      rules
    };
  } else {
    if (pluginName !== "@stylistic")
      throw new Error("PluginName in non-flat config can not be customized");
    return {
      plugins: ["@stylistic"],
      rules
    };
  }
}

const recommendedExtends = /* @__PURE__ */ customize({ flat: false });
const _configs = {
  /**
   * Disable all legacy rules from `eslint`, `@typescript-eslint` and `eslint-plugin-react`
   *
   * This config works for both flat and legacy config format
   */
  "disable-legacy": config,
  /**
   * A factory function to customize the recommended config
   */
  "customize": customize,
  /**
   * The default recommended config in Flat Config Format
   */
  "recommended-flat": /* @__PURE__ */ customize(),
  /**
   * The default recommended config in Legacy Config Format
   */
  "recommended-extends": recommendedExtends,
  /**
   * Enable all rules, in Flat Config Format
   */
  "all-flat": createAllConfigs(plugin, "@stylistic", true, (name) => !name.startsWith("jsx-")),
  /**
   * Enable all rules, in Legacy Config Format
   */
  "all-extends": createAllConfigs(plugin, "@stylistic", false, (name) => !name.startsWith("jsx-")),
  /**
   * @deprecated Use `recommended-extends` instead
   */
  "recommended-legacy": recommendedExtends
};
const configs = _configs;

exports.configs = configs;
exports.plugin = plugin;
