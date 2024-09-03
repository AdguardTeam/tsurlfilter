# <a name="homepage"></a> ExtendedCss [![npm-badge]][npm-url] [![install-size-badge]][install-size-url] [![license-badge]][license-url]

AdGuard's TypeScript library for non-standard element selecting and applying CSS styles with extended properties.

The idea of extended capabilities is an opportunity to match DOM elements with selectors based on their own representation (style, text content, etc.) or relations with other elements. There is also an opportunity to apply styles with non-standard CSS properties.

* [Extended capabilities](#extended-capabilities)
  * [Limitations](#extended-css-limitations)
  * [Pseudo-class `:has()`](#extended-css-has)
  * [Pseudo-class `:contains()`](#extended-css-contains)
  * [Pseudo-class `:matches-css()`](#extended-css-matches-css)
  * [Pseudo-class `:matches-attr()`](#extended-css-matches-attr)
  * [Pseudo-class `:matches-property()`](#extended-css-matches-property)
  * [Pseudo-class `:xpath()`](#extended-css-xpath)
  * [Pseudo-class `:nth-ancestor()`](#extended-css-nth-ancestor)
  * [Pseudo-class `:upward()`](#extended-css-upward)
  * [Pseudo-class `:remove()` and pseudo-property `remove`](#remove-pseudos)
  * [Pseudo-class `:is()`](#extended-css-is)
  * [Pseudo-class `:not()`](#extended-css-not)
  * [Pseudo-class `:if-not()` (deprecated)](#extended-css-if-not)
  * [Selectors debugging mode](#selectors-debug-mode)
  * [Backward compatible syntax](#extended-css-old-syntax)
* [How to build](#how-to-build)
* [How to test](#how-to-test)
* [Usage](#usage)
  * [API description](#extended-css-api)
    * [Constructor](#extended-css-constructor)
    * [init()](#extended-css-init)
    * [apply() and dispose()](#extended-css-apply-dispose)
    * [query()](#extended-css-query)
    * [validate()](#extended-css-validate)
    * [EXTENDED_CSS_VERSION](#extended-css-version)
  * [Debugging extended selectors](#debugging-extended-selectors)
* [Projects using ExtendedCss](#projects-using-extended-css)
* [Browser compatibility](#browser-compatibility)
* [Known issues](#known-issues)


## Extended capabilities

> Some pseudo-classes does not require a selector before them. Still adding a [universal selector](https://www.w3.org/TR/selectors-4/#the-universal-selector) `*` makes an extended selector easier to read, even though it has no effect on the matching behavior. So the selector `#block :has(> .inner)` works exactly like `#block *:has(> .inner)` but second one is more obvious.

> Pseudo-class names are case-insensitive, e.g. `:HAS()` works as `:has()`. Still the lower-case names are used commonly.

### <a name="extended-css-limitations"></a> Limitations

1. CSS [comments](https://developer.mozilla.org/en-US/docs/Web/CSS/Comments) and [at-rules](https://developer.mozilla.org/en-US/docs/Web/CSS/At-rule) are not supported.

2. Specific pseudo-class may have its own limitations:
[`:has()`](#extended-css-has-limitations), [`:xpath()`](#extended-css-xpath-limitations), [`:nth-ancestor()`](#extended-css-nth-ancestor-limitations), [`:upward()`](#extended-css-upward-limitations), [`:is()`](#extended-css-is-limitations), [`:not()`](#extended-css-not-limitations), and [`:remove()`](#extended-css-remove-limitations).


### <a name="extended-css-has"></a> Pseudo-class `:has()`

Draft CSS 4.0 specification describes the [`:has()` pseudo-class](https://www.w3.org/TR/selectors-4/#relational). Unfortunately, [it is not yet supported](https://caniuse.com/css-has) by all popular browsers.

> Rules with the `:has()` pseudo-class should use [native implementation of `:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has) if they use `##` marker and if it is possible, i.e. with no other extended selectors inside. To force applying ExtendedCss rules with `:has()`, use `#?#`/`#$?#` marker explicitly.

> Synonym `:-abp-has` is supported by ExtendedCss for better compatibility.

> `:if()` is no longer supported as a synonym for `:has()`.

**Syntax**

```
[target]:has(selector)
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `selector` — required, standard or extended CSS selector

The pseudo-class `:has()` selects the `target` elements that fit to the `selector`. Also the `selector` can start with a combinator.

A selector list can be set in `selector` as well. In this case **all** selectors in the list are being matched for now. It is [one of the known issues](#known-issues) and will be fixed for `<forgiving-relative-selector-list>` as argument.

<a name="extended-css-has-limitations"></a> **Limitations and notes**

> Usage of the `:has()` pseudo-class is [restricted for some cases (2, 3)](https://bugs.chromium.org/p/chromium/issues/detail?id=669058#c54):
> - disallow `:has()` inside the pseudos accepting only compound selectors;
> - disallow `:has()` after regular pseudo-elements.

> Native `:has()` pseudo-class does not allow `:has()`, `:is()`, `:where()` inside `:has()` argument to avoid increasing the `:has()` invalidation complexity ([case 1](https://bugs.chromium.org/p/chromium/issues/detail?id=669058#c54)). But ExtendedCss did not have such limitation earlier and filter lists already contain such rules, so we have not added this limitation to ExtendedCss and allow to use `:has()` inside `:has()` as it was possible before. To use it, just force ExtendedCss usage by setting `#?#`/`#$?#` rule marker.

> Native implementation does not allow any usage of `:scope` inside `:has()` argument ([[1]](https://github.com/w3c/csswg-drafts/issues/7211), [[2]](https://github.com/w3c/csswg-drafts/issues/6399)). Still, there are some such rules in filter lists: `div:has(:scope > a)` which we continue to support by simply converting them to `div:has(> a)`, as it used to be done previously.

**Examples**

`div:has(.banner)` selects all `div` elements which **include** an element with the `banner` class:
```html
<!-- HTML code -->
<div>Not selected</div>
<div>Selected
  <span class="banner">inner element</span>
</div>
```

`div:has(> .banner)` selects all `div` elements which **include** an `banner` class element as a *direct child* of `div`:
```html
<!-- HTML code -->
<div>Not selected</div>
<div>Selected
  <p class="banner">child element</p>
</div>
```

`div:has(+ .banner)` selects all `div` elements **preceding** `banner` class element which *immediately follows* the `div` and both are children of the same parent:
```html
<!-- HTML code -->
<div>Not selected</div>
<div>Selected</div>
<p class="banner">adjacent sibling</p>
<span>Not selected</span>
```

`div:has(~ .banner)` selects all `div` elements **preceding** `banner` class element which *follows* the `div` but *not necessarily immediately* and both are children of the same parent:
```html
<!-- HTML code -->
<div>Not selected</div>
<div>Selected</div>
<span>Not selected</span>
<p class="banner">general sibling</p>
```

`div:has(span, .banner)` selects all `div` elements which **include both** `span` element and `banner` class element:
```html
<!-- HTML code -->
<div>Not selected</div>
<div>Selected
  <span>child span</span>
  <p class="banner">child .banner</p>
</div>
```

> [Backward compatible syntax for `:has()`](#old-syntax-has) is supported but not recommended.


### <a name="extended-css-contains"></a> Pseudo-class `:contains()`

This pseudo-class principle is very simple: it allows to select the elements that contain specified text or which content matches a specified regular expression. Regexp flags are supported.

> Pseudo-class `:contains()` uses the `textContent` element property for matching, not the `innerHTML`.

> Synonyms `:-abp-contains` and `:has-text` are supported for better compatibility.

**Syntax**

```
[target]:contains(match)
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `match` — required, string or regular expression for matching element textContent

> Regexp flags are supported for `match`.

**Examples**

For such DOM:
```html
<!-- HTML code -->
<div>Not selected</div>
<div id="match">Selected as IT contains "banner"</div>
<div>Not selected <div class="banner"></div></div>
```

`div#match` can be selected by any on these extended selectors:
```
! plain text
div:contains(banner)

! regular expression
div:contains(/as .* banner/)

! regular expression with flags
div:contains(/it .* banner/gi)
```

> Only the `div` with `id=match` is selected because the next element does not contain any text, and `banner` is a part of code, not a text.

> [Backward compatible syntax for `:contains()`](#old-syntax-contains) is supported but not recommended.


### <a name="extended-css-matches-css"></a> Pseudo-class `:matches-css()`

Pseudo-class `:matches-css()` allows to match the element by its current style properties. The work of the pseudo-class is based on using the [`Window.getComputedStyle()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) method.

**Syntax**

```
[target]:matches-css([pseudo-element, ] property: pattern)
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `pseudo-element` — optional, valid standard pseudo-element, e.g. `before`, `after`, `first-line`, etc.
- `property` — required, a name of CSS property to check the element for
- `pattern` —  required, a value pattern that is using the same simple wildcard matching as in the basic url filtering rules OR a regular expression. For this type of matching, AdGuard always does matching in a case-insensitive manner. In the case of a regular expression, the pattern looks like `/regexp/`.

> For **non-regexp** patterns `(`,`)`,`[`,`]` must be **unescaped**, e.g. `:matches-css(background-image:url(data:*))`.

> For **regexp** patterns `\` should be **escaped**, e.g. `:matches-css(background-image: /^url\\("data:image\\/gif;base64.+/)`.

<!-- TODO: https://github.com/AdguardTeam/ExtendedCss/issues/138 -->
> Regexp patterns **do not support** flags.

**Examples**

For such DOM:
```html
<!-- HTML code -->
<style type="text/css">
    #matched::before {
        content: "Block me"
    }
</style>
<div id="matched"></div>
<div id="not-matched"></div>
```

`div` elements with pseudo-element `::before` with specified `content` property can be selected by any of these extended selectors:
```
! string pattern
div:matches-css(before, content: block me)

! string pattern with wildcard
div:matches-css(before, content: block*)

! regular expression pattern
div:matches-css(before, content: /block me/)
```

> Obsolete pseudo-classes `:matches-css-before()` and `:matches-css-after()` are supported for better compatibility.

> [Backward compatible syntax for `:matches-css()`](#old-syntax-matches-css) is supported but not recommended.


### <a name="extended-css-matches-attr"></a> Pseudo-class `:matches-attr()`

Pseudo-class `:matches-attr()` allows to select an element by its attributes, especially if they are randomized.

**Syntax**

```
[target]:matches-attr("name"[="value"])
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `name` — required, simple string *or* string with wildcard *or* regular expression for attribute name matching
- `value` — optional, simple string *or* string with wildcard *or* regular expression for attribute value matching

> For **regexp** patterns `"` and `\` should be **escaped**, e.g. `div:matches-attr(class=/[\\w]{5}/)`.

> Regexp patterns **do not support** flags.

**Examples**

`div:matches-attr("ad-link")` selects the element `div#target1`:
```html
<!-- HTML code -->
<div id="target1" ad-link="1random23-banner_240x400"></div>
```

`div:matches-attr("data-*"="adBanner")` selects the element `div#target2`:
```html
<!-- HTML code -->
<div id="target2" data-1random23="adBanner"></div>
```

`div:matches-attr(*unit*=/^click$/)` selects the element `div#target3`:
```html
<!-- HTML code -->
<div id="target3" random123-unit094="click"></div>
```

`*:matches-attr("/.{5,}delay$/"="/^[0-9]*$/")` selects the element `#target4`:
```html
<!-- HTML code -->
<div>
  <inner-random23 id="target4" nt4f5be90delay="1000"></inner-random23>
</div>
```


### <a name="extended-css-matches-property"></a> Pseudo-class `:matches-property()`

Pseudo-class `:matches-property()` allows to select an element by matching its properties.

**Syntax**

```
[target]:matches-property("name"[="value"])
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `name` — required, simple string *or* string with wildcard *or* regular expression for element property name matching
- `value` — optional, simple string *or* string with wildcard *or* regular expression for element property value matching

> For **regexp** patterns `"` and `\` should be escaped, e.g. `div:matches-property(prop=/[\\w]{4}/)`.

> Regexp patterns are supported in `name` for any property in chain, e.g. `prop./^unit[\\d]{4}$/.type`.

> Regexp patterns **do not support** flags.

**Examples**

An element with such properties:
```javascript
divProperties = {
  id: 1,
  check: {
    track: true,
    unit_2random1: true,
  },
  memoizedProps: {
    key: null,
    tag: 12,
    _owner: {
      effectTag: 1,
      src: 'ad.com',
    },
  },
};
```

can be selected by any of these extended selectors:
```
div:matches-property(check.track)

div:matches-property("check./^unit_.{4,8}$/")

div:matches-property("check.unit_*"=true)

div:matches-property(memoizedProps.key="null")

div:matches-property(memoizedProps._owner.src=/ad/)
```

> **For filters maintainers:** To check properties of a specific element, do the following:
> 1. Inspect the page element or select it in `Elements` tab of browser DevTools.
> 2. Run `console.dir($0)` in `Console` tab.


### <a name="extended-css-xpath"></a> Pseudo-class `:xpath()`

The `:xpath()` pseudo-class allows to select an element by evaluating an XPath expression.

**Syntax**

```
[target]:xpath(expression)
```
- `target`- optional, standard or extended CSS selector
- `expression` — required, valid XPath expression

<a name="extended-css-xpath-limitations"></a> **Limitations**

> `target` can be omitted so it is optional. For any other pseudo-class that would mean "apply to *all* DOM nodes", but in case of `:xpath()` it just means "apply to the *whole* document", and such applying slows elements selecting significantly. That's why rules like `#?#:xpath(expression)` are limited to looking inside the `body` tag. For example, rule `#?#:xpath(//div[@data-st-area=\'Advert\'])` is parsed as `#?#body:xpath(//div[@data-st-area=\'Advert\'])`.

> Extended selectors with defined `target` as *any* selector — `*:xpath(expression)` — can still be used but it is not recommended, so `target` should be specified instead.

> Works properly only at the end of selector, except for [pseudo-class :remove()](#remove-pseudos).

**Examples**

`:xpath(//*[@class="banner"])` selects the element `div#target1`:
```html
<!-- HTML code -->
<div id="target1" class="banner"></div>
```

`:xpath(//*[@class="inner"]/..)` selects the element `div#target2`:
```html
<!-- HTML code -->
<div id="target2">
  <div class="inner"></div>
</div>
```


### <a name="extended-css-nth-ancestor"></a> Pseudo-class `:nth-ancestor()`

The `:nth-ancestor()` pseudo-class allows to lookup the *nth* ancestor relative to the previously selected element.

**Syntax**

```
subject:nth-ancestor(n)
```
- `subject` — required, standard or extended CSS selector
- `n` — required, number >= 1 and < 256, distance to the needed ancestor from the element selected by `subject`

<a name="extended-css-nth-ancestor-limitations"></a> **Limitations**

> Pseudo-class `:nth-ancestor()` is not supported inside the argument of the [`:not()` pseudo-class](#extended-css-not). It is [one of the known issues](#known-issues).

**Examples**

For such DOM:
```html
<!-- HTML code -->
<div id="target1">
  <div class="child"></div>

  <div id="target2">
    <div>
      <div>
        <div class="inner"></div>
      </div>
    </div>
  </div>
</div>
```

`.child:nth-ancestor(1)` selects the element `div#target1`,
`div[class="inner"]:nth-ancestor(3)` selects the element `div#target2`.


### <a name="extended-css-upward"></a> Pseudo-class `:upward()`

The `:upward()` pseudo-class allows to lookup the ancestor relative to the previously selected element.

**Syntax**

```
subject:upward(ancestor)
```
- `subject` — required, standard or extended CSS selector
- `ancestor` — required, specification for the ancestor of the element selected by `subject`, can be set as:
  - *number* >= 1 and < 256 for distance to the needed ancestor, same as [`:nth-ancestor()`](#extended-css-nth-ancestor)
  - *standard CSS selector* for matching closest ancestor

<a name="extended-css-upward-limitations"></a> **Limitations**

> Pseudo-class `:upward()` is not supported inside the argument of the [`:not()` pseudo-class](#extended-css-not) argument. It is [one of the known issues](#known-issues).

**Examples**

For such DOM:
```html
<!-- HTML code -->
<div id="target1" data="true">
  <div class="child"></div>

  <div id="target2">
    <div>
      <div>
        <div class="inner"></div>
      </div>
    </div>
  </div>
</div>
```

`.inner:upward(div[data])` selects the element `div#target1`,
`.inner:upward(div[id])` selects the element `div#target2`,
`.child:upward(1)` selects the element `div#target1`,
`.inner:upward(3)` selects the element `div#target2`.


### <a name="remove-pseudos"></a> Pseudo-class `:remove()` and pseudo-property `remove`

Sometimes, it is necessary to remove a matching element instead of hiding it or applying custom styles. In order to do it, you can use the `:remove()` pseudo-class as well as the `remove` pseudo-property.

**Syntax**

```
! pseudo-class
selector:remove()

! pseudo-property
selector { remove: true; }
```
- `selector` — required, standard or extended CSS selector

<a name="extended-css-remove-limitations"></a> **Limitations**

> The `:remove()` pseudo-class is limited to work properly only at the end of selector.

> For applying the `:remove()` pseudo-class to any element [universal selector](https://www.w3.org/TR/selectors-4/#the-universal-selector) `*` should be used. Otherwise such extended selector may be considered as invalid, e.g. `.banner > :remove()` is not valid for removing any child element of `banner` class element, so it should look like `.banner > *:remove()`.

> If the `:remove()` pseudo-class or the `remove` pseudo-property is used, all style properties are ignored except for the [`debug` pseudo-property](#selectors-debug-mode).

**Examples**

```
div.banner:remove()
div:has(> div[ad-attr]):remove()

div:contains(advertisement) { remove: true; }
div[class]:has(> a > img) { remove: true; }
```

> Rules with the `remove` pseudo-property should use `#$?#` marker: `$` for CSS style rules syntax, `?` for ExtendedCss syntax.

<!-- TODO: consider :remove() pseudo-class deprecation -->
<!-- https://github.com/AdguardTeam/ExtendedCss/issues/160 -->
> Both `:remove()` pseudo-class and `remove` pseudo-property works the same, but we recommend to use the pseudo-property as it is related to an action which should be applied to element, since pseudo-classes is more about elements matching.

### <a name="extended-css-is"></a> Pseudo-class `:is()`

The `:is()` pseudo-class allows to match any element that can be selected by any of selectors passed to it. Invalid selectors are skipped and the pseudo-class deals with valid ones with no error thrown. Our implementation of the [native `:is()` pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:is).

**Syntax**

```
[target]:is(selectors)
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `selectors` — [*forgiving selector list*](https://drafts.csswg.org/selectors-4/#typedef-forgiving-selector-list) of standard or extended selectors. For extended selectors only compound selectors are supported, not complex.

<a name="extended-css-is-limitations"></a> **Limitations**

> Rules with the `:is()` pseudo-class should use the [native implementation of `:is()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:is) if rules use `##` marker and it is possible, i.e. with no other extended selectors inside. To force applying ExtendedCss rules with `:is()`, use `#?#`/`#$?#` marker explicitly.

> If the `:is()` pseudo-class argument `selectors` is an extended selector, due to the way how the `:is()` pseudo-class is implemented in ExtendedCss v2.0, it is impossible to apply it to the top DOM node which is `html`, i.e. `#?#html:is(<extended-selectors>)` does not work. So if `target` is not defined or defined as an [universal selector](https://www.w3.org/TR/selectors-4/#the-universal-selector) `*`, the extended pseudo-class applying is limited to **`html`'s children**, e.g. rules `#?#:is(...)` and `#?#*:is(...)` are parsed as `#?#html *:is(...)`. Please note that there is no such limitation for a standard selector argument, i.e. `#?#html:is(.locked)` works fine.

> [Complex selectors](https://www.w3.org/TR/selectors-4/#complex) with extended pseudo-classes are not supported as `selectors` argument for `:is()` pseudo-class, only [compound ones](https://www.w3.org/TR/selectors-4/#compound) are allowed. It is [one of the known issues](#known-issues). Check examples below for more details.

**Examples**

`#container *:is(.inner, .footer)` selects only the element `div#target1`:
```html
<!-- HTML code -->
<div id="container">
  <div data="true">
    <div>
      <div id="target1" class="inner"></div>
    </div>
  </div>
</div>
```

Due to limitations `:is(*:not([class]) > .banner)'` does not work
but `:is(*:not([class]):has(> .banner))` can be used instead of it to select the element `div#target2`:
```html
<!-- HTML code -->
<span class="span">text</span>
<div id="target2">
  <p class="banner">inner paragraph</p>
</div>
```


### <a name="extended-css-not"></a> Pseudo-class `:not()`

The `:not()` pseudo-class allows to select elements which are *not matched* by selectors passed as argument. Invalid argument selectors are not allowed and error is to be thrown. Our implementation of the [`:not()` pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:not).

**Syntax**

```
[target]:not(selectors)
```
- `target` — optional, standard or extended CSS selector, can be missed for checking *any* element
- `selectors` — list of standard or extended selectors

<a name="extended-css-not-limitations"></a> **Limitations**

> Rules with the `:not()` pseudo-class should use the [native implementation of `:not()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:not) if rules use `##` marker and it is possible, i.e. with no other extended selectors inside. To force applying ExtendedCss rules with `:not()`, use `#?#`/`#$?#` marker explicitly.

> If the `:not()` pseudo-class argument `selectors` is an extended selector, due to the way how the `:not()` pseudo-class is implemented in ExtendedCss v2.0, it is impossible to apply it to the top DOM node which is `html`, i.e. `#?#html:not(<extended-selectors>)` does not work. So if `target` is not defined or defined as an [universal selector](https://www.w3.org/TR/selectors-4/#the-universal-selector) `*`, the extended pseudo-class applying is limited to **`html`'s children**, e.g. rules `#?#:not(...)` and `#?#*:not(...)` are parsed as `#?#html *:not(...)`. Please note that there is no such limitation for a standard selector argument, i.e. `#?#html:not(.locked)` works fine.

> The `:not()` is considered as a standard CSS pseudo-class inside argument of the [`:upward()` pseudo-class](#extended-css-upward) because `:upward()` supports only standard selectors.

> "Up-looking" pseudo-classes which are [`:nth-ancestor()`](#extended-css-nth-ancestor) and [`:upward()`](#extended-css-upward) are not supported inside `selectors` argument for `:not()` pseudo-class. It is [one of the known issues](#known-issues).

**Examples**

`#container > *:not(h2, .text)` selects only the element `div#target1`:
```html
<!-- HTML code -->
<div id="container">
  <h2>Header</h2>
  <div id="target1"></div>
  <span class="text">text</span>
</div>
```


### <a name="extended-css-if-not"></a> Pseudo-class `:if-not()` (deprecated)

> The `:if-not()` pseudo-class is deprecated and is no longer supported. Rules with it are considered as invalid.

This pseudo-class was basically a shortcut for `:not(:has())`. It was supported by ExtendedCss for better compatibility with some filters subscriptions.


### <a name="selectors-debug-mode"></a> Selectors debugging mode

Sometimes, you might need to check the performance of a given selector or a stylesheet. In order to do it without interacting with JavaScript directly, you can use a special `debug` style property. When `ExtendedCss` meets this property, it enables the debugging mode either for a single selector or for all selectors, depending on the `debug` value.

Sometimes, you might need to check the performance of a given selector or a stylesheet. In order to do it without interacting with JavaScript directly, you can use a special `debug` style property. When `ExtendedCss` meets this property, it enables the debugging mode either for a single selector or for all selectors, depending on the `debug` value.

Open the browser console while on a web page to see the timing statistics for selector(s) that were applied there. Debugging mode displays the following stats as object where each of the debugged selectors are keys, and value is an object with such properties:

**Always printed:**
* `selectorParsed` — text of eventually parsed selector
* `timings` — list of DOM nodes matched by the selector
  * `appliesCount` — total number of times that the selector has been applied on the page
  * `appliesTimings` — time that it took to apply the selector on the page, for each of the instances that it has been applied (in milliseconds)
  * `meanTiming` — mean time that it took to apply the selector on the page
  * `standardDeviation` — standard deviation
  * `timingsSum` — total time it took to apply the selector on the page across all instances

**Printed only for remove pseudos:**
* `removed` — flag to signal if elements we removed

**Printed if elements are not removed:**
* `matchedElements` — list of DOM nodes matched by the selector
* `styleApplied` — parsed rule style declaration related to the selector

**Examples**

**Debugging a single selector:**

When the value of the `debug` property is `true`, only information about this selector will be shown in the browser console.

```
#$?#.banner { display: none; debug: true; }
```

**Enabling global debug:**

When the value of the `debug` property is `global`, the console will display information about all extended CSS selectors that have matches on the current page, for all the rules from any of the enabled filters.

```
#$?#.banner { display: none; debug: global; }
```

> Global debugging mode also can be enabled by positive `debug` property in [`ExtCssConfiguration`](#ext-css-configuration-interface):
```js
const extendedCss = new ExtendedCss({
  styleSheet, // required, rules as string
  debug,      // optional, boolean
});
```


### <a name="extended-css-old-syntax"></a> Backward compatible syntax

**Backward compatible syntax is supported but not recommended.**

### <a name="old-syntax-has"></a> Old syntax for pseudo-class `:has()`

**Syntax**
```
target[-ext-has="selector"]
```

**Examples**
```
div[-ext-has=".banner"]
```
```html
<!-- HTML code -->
<div>Not selected</div>
<div>Selected <span class="banner"></span></div>
```


### <a name="old-syntax-contains"></a> Old syntax for pseudo-class `:contains()`

**Syntax**
```
// matching by plain text
target[-ext-contains="text"]

// matching by a regular expression
target[-ext-contains="/regex/"]
```

**Examples**
```
// matching by plain text
div[-ext-contains="banner"]

// matching by a regular expression
div[-ext-contains="/this .* banner/"]
```

```html
<!-- HTML code -->
<div>Not selected</div>
<div id="selected">Selected as it contains "banner"</div>
```


### <a name="old-syntax-matches-css"></a> Old syntax for pseudo-class `:matches-css()`

**Syntax**
```
target[-ext-matches-css="property: pattern"]
target[-ext-matches-css-after="property: pattern"]
target[-ext-matches-css-before="property: pattern"]
```

**Examples**
```html
<!-- HTML code -->
<style type="text/css">
    #matched::before {
        content: "Block me"
    }
</style>
<div id="matched"></div>
<div id="not-matched"></div>
```

```
! string pattern
div[-ext-matches-css-before="content: block me"]

! regular expression pattern
div[-ext-matches-css-before="content: /block me/"]
```


## How to build

Install dependencies
```
yarn install
```

And just run
```
yarn build
```

## How to test

Install dependencies
```
yarn install
```

Run local node testing
```
yarn test local
```

Run performance tests which are not included in `test local` run and should be executed manually:
```
yarn test performance
```

## Usage

You can import, require or copy IIFE module with ExtendedCss into your code, e.g.
```
import ExtendedCss from 'extended-css';
```
or
```
const ExtendedCss = require('extended-css');
```
IIFE module can be found by the following path `./dist/extended-css.js`

After that you can use ExtendedCss as you wish.

### <a name="extended-css-api"></a> API description

#### <a name="extended-css-constructor"></a> Constructor

```
/**
 * Creates an instance of ExtendedCss
 *
 * @param configuration — required
 */
constructor(configuration: ExtCssConfiguration)
```

<a name="ext-css-configuration-interface"></a>
where
```ts
interface ExtCssConfiguration {
  // css stylesheet — css rules combined in one string
  styleSheet?: string;

  // css rules — array of separated css rules
  cssRules?: string;

  // the callback that handles affected elements
  beforeStyleApplied?: BeforeStyleAppliedCallback;

  // flag for applied selectors logging; equals to `debug: global` in `styleSheet`
  debug?: boolean;
}
```

> Both `styleSheet` and `cssRules` are optional but at least one of them should be set.

> If both `styleSheet` and `cssRules` are set, both of them are to be applied.

```ts
/**
 * Needed for getting affected node elements and handle style properties before they are applied to them if it is necessary.
 *
 * Used by AdGuard Browser extension to display rules in Filtering log and `collect-hits-count` (via tsurlfilter's CssHitsCounter)
 */
type BeforeStyleAppliedCallback = (x:IAffectedElement) => IAffectedElement;

/**
 * Simplified just for representation.
 * Its optional property 'content' may contain the applied rule text
 */
interface IAffectedElement {
  rules: { style: { content?: string }}[]
  node: HTMLElement;
}
```

#### <a name="extended-css-init"></a> Public method `init()`

The `init()` public method initializes ExtendedCss on a page.
It should be executed on page **as soon as possible**,
even before the ExtendedCss instance is constructed,
otherwise the `:contains()` pseudo-class may work incorrectly.

#### <a name="extended-css-apply-dispose"></a> Public methods `apply()` and `dispose()`

After the instance of ExtendedCss is created, it can be applied on the page by the `apply()` method. Its applying also can be stopped and styles are to be restored by the `dispose()` method.

```js
(function() {
  let styleSheet = 'div.wrapper > div:has(.banner) { display:none!important; }\n';
  styleSheet += 'div.wrapper > div:contains(ads) { background:none!important; }';
  const extendedCss = new ExtendedCss({ styleSheet });

  // apply styleSheet
  extendedCss.apply();

  // stop applying of this styleSheet
  setTimeout(function() {
    extendedCss.dispose();
  }, 10 * 1000);
})();
```

#### <a name="extended-css-query"></a> Public method `query()`
```ts
/**
 * Returns a list of the document's elements that match the specified selector
 *
 * @param {string} selector — selector text
 * @param {boolean} [noTiming=true] — optional, if true -- do not print the timing to the console
 *
 * @returns a list of elements found
 * @throws an error if the argument is not a valid selector
 */
public static query(selector: string, noTiming = true): HTMLElement[]
```

#### <a name="extended-css-validate"></a> Public method `validate()`

```ts
/**
 * Validates selector
 * @param selector — selector text
 */
public static validate(selector: string): ValidationResult
```

where
```ts
type ValidationResult = {
    // true for valid selector, false for invalid one
    ok: boolean,
    // specified for invalid selector
    error: string | null,
};
```

#### <a name="extended-css-version"></a> Public property `EXTENDED_CSS_VERSION`

type: `string`

Current version of ExtendedCss.

### Debugging extended selectors

ExtendedCss can be executed on any page without using any AdGuard product. In order to do that you should copy and execute the following code in a browser console:
```js
!function(e,t,d){C=e.createElement(t),C.src=d,C.onload=function(){alert("ExtendedCss loaded successfully")},s=e.getElementsByTagName(t)[0],s?s.parentNode.insertBefore(C,s):(h=e.getElementsByTagName("head")[0],h.appendChild(C))}(document,"script","https://AdguardTeam.github.io/ExtendedCss/extended-css.min.js");
```

Alternatively, install the [`ExtendedCssDebugger` userscript](https://github.com/AdguardTeam/Userscripts/blob/master/extendedCssDebugger/extended-css.debugger.user.js).

Now you can now use the `ExtendedCss` from global scope, and run its method [`query()`](#extended-css-query) as `Document.querySelectorAll()`

**Examples**

```js
const selector = 'div.block:has(.header:matches-css(after, content: Ads))';

// array of HTMLElements matched the `selector` is to be returned
ExtendedCss.query(selector);
```


## <a name="projects-using-extended-css"></a> Projects using ExtendedCss

* [CoreLibs](https://github.com/AdguardTeam/CoreLibs) — `Content Script` dist should be updated
* [TSUrlFilter](https://github.com/AdguardTeam/tsurlfilter)
* [FiltersCompiler](https://github.com/AdguardTeam/FiltersCompiler)
* [AdguardBrowserExtension](https://github.com/AdguardTeam/AdguardBrowserExtension) — `TSUrlFilter` should be updated
* [AdguardForSafari](https://github.com/AdguardTeam/AdGuardForSafari) — `adguard-resources` should be updated
* [AdguardForiOS](https://github.com/AdguardTeam/AdguardForiOS)  — both `ExtendedCss` and `TSUrlFilter` should be updated in `advanced-adblocker-web-extension`


### <a name="browser-compatibility"></a> Browser compatibility

| Browser               | Version   |
|-----------------------|:----------|
| Chrome                | ✅ 88     |
| Firefox               | ✅ 84     |
| Edge                  | ✅ 88     |
| Opera                 | ✅ 80     |
| Safari                | ✅ 14     |
| Internet Explorer     | ❌        |


### <a name="known-issues"></a> Known issues

- `:has()` pseudo-class should take [`<forgiving-relative-selector-list>` as argument](https://github.com/AdguardTeam/ExtendedCss/issues/154)
- `:nth-ancestor()` and `:upward()` are not supported [inside of `:not()` pseudo-class argument](https://github.com/AdguardTeam/ExtendedCss/issues/155)
- `:is()` pseudo-class does not support [complex selectors](https://github.com/AdguardTeam/ExtendedCss/issues/156)


[npm-badge]: https://img.shields.io/npm/v/@adguard/extended-css
[npm-url]: https://www.npmjs.com/package/@adguard/extended-css

[install-size-badge]: https://packagephobia.com/badge?p=@adguard/extended-css
[install-size-url]: https://packagephobia.com/result?p=@adguard/extended-css

[license-badge]: https://img.shields.io/github/license/AdGuardTeam/ExtendedCss
[license-url]: https://github.com/AdguardTeam/ExtendedCss/blob/master/LICENSE
