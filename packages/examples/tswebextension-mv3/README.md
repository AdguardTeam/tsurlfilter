# TSWebExtension - Manifest v3 Sample Extension

This is a sample extension, presenting common usages of TSWebExtension library in manifest v3 extensions.

## <a id="idea"></a> Idea

The idea is to provide an operative scheme of extension and to show some cases with manifest v3 limitations:

- Precompile rules to json [See more](#precompile)

## <a id="usage"></a> Development

### <a id="build"></a> Building

Builds an extension ready to use:

```shell
pnpm build
```

### <a id="precompile"></a> Precompile declarative rules

Updates and converts rules from provided path to a set of declarative rules:

```shell
pnpm build:precompile-rules
```

### Demo example

1. Extension will be automatically turned on filtering after installed.
To check work of filters - go to <https://canyoublockit.com/testing/>. Site will
be blocked.

2. Filters. You can toggle any of filters. For example, you can turn off.
"Filter 2", go to <https://canyoublockit.com/testing/> - site will open.

3. User rules. You can apply any custom user rules, for example rule
`||example.org$document`. Then, click "Apply" and go to <https://example.org>,
the site will be blocked.

4. Cosmetic rules at now applies with huge (about 2 seconds) latency.

5. **Declarative filtering log.** You can open the developer tools, go to the
"AdGuard" tab, and see what declarative network rules have been applied to the
page.
