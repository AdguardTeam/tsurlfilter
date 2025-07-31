import { type Request } from '../request';

import { SimpleRegex } from './simple-regex';

/**
 * Rule pattern class.
 *
 * This class parses rule pattern text to simple fields.
 */
export class Pattern {
    /**
     * Original pattern text.
     */
    public readonly pattern: string;

    /**
     * Shortcut string.
     */
    public readonly shortcut: string;

    /**
     * If this pattern already prepared indicator.
     */
    private prepared: boolean | undefined;

    /**
     * Parsed hostname.
     */
    private hostname: string | undefined;

    /**
     * Parsed regular expression.
     */
    private regex: RegExp | undefined;

    /**
     * Invalid regex flag.
     */
    private regexInvalid: boolean | undefined;

    /**
     * Domain specific pattern flag.
     */
    private patternDomainSpecific: boolean | undefined;

    /**
     * If true, pattern and shortcut are the same.
     * In this case, we don't actually need to use `matchPattern`
     * if shortcut was already matched.
     */
    private patternShortcut: boolean | undefined;

    /**
     * If pattern is match-case regex.
     */
    private readonly matchcase: boolean | undefined;

    /**
     * Constructor.
     *
     * @param pattern Pattern.
     * @param matchcase Flag for case-sensitive matching, default is false.
     */
    constructor(pattern: string, matchcase = false) {
        this.pattern = pattern;
        this.shortcut = SimpleRegex.extractShortcut(this.pattern);
        this.matchcase = matchcase;
    }

    /**
     * Checks if this rule pattern matches the specified request.
     *
     * @param request Request to check.
     * @param shortcutMatched If true, it means that the request already matches
     * this pattern's shortcut and we don't need to match it again.
     *
     * @returns True if pattern matches.
     */
    public matchPattern(request: Request, shortcutMatched: boolean): boolean {
        this.prepare();

        if (this.patternShortcut) {
            return shortcutMatched || this.matchShortcut(request.urlLowercase);
        }

        if (this.hostname) {
            // If we have a `||example.org^` rule, it's easier to match
            // against the request's hostname only without matching
            // a regular expression.
            return request.hostname === this.hostname
                || (// First light check without new string memory allocation
                    request.hostname.endsWith(this.hostname)
                    // Strict check
                    && request.hostname.endsWith(`.${this.hostname}`));
        }

        // If the regular expression is invalid, just return false right away.
        if (this.regexInvalid || !this.regex) {
            return false;
        }

        // This is needed for DNS filtering only, not used in browser blocking.
        if (this.shouldMatchHostname(request)) {
            return this.regex.test(request.hostname);
        }

        return this.regex.test(request.url);
    }

    /**
     * Checks if this rule pattern matches the specified relative path string.
     * This method is used in cosmetic rules to implement the $path modifier matching logic.
     *
     * @param path Path to check.
     *
     * @returns True if pattern matches.
     */
    public matchPathPattern(path: string): boolean {
        this.prepare();

        if (this.hostname) {
            return false;
        }

        const pathIsEmptyString = this.pattern === '';
        // No-value $path should match root URL
        if (pathIsEmptyString && path === '/') {
            return true;
        }
        if (!pathIsEmptyString && this.patternShortcut) {
            return this.matchShortcut(path);
        }

        // If the regular expression is invalid, just return false right away.
        if (this.regexInvalid || !this.regex) {
            return false;
        }

        return this.regex.test(path);
    }

    /**
     * Simply checks if shortcut is a substring of the URL.
     *
     * @param str Shortcut to check.
     *
     * @returns True if the shortcut is a substring of the URL.
     */
    private matchShortcut(str: string): boolean {
        return str.indexOf(this.shortcut) >= 0;
    }

    /**
     * Prepares this pattern.
     */
    private prepare(): void {
        if (this.prepared) {
            return;
        }
        this.prepared = true;

        // If shortcut and pattern are the same, we don't need to actually compile
        // a regex and can simply use matchShortcut instead,
        // except for the $match-case modifier
        if (this.pattern === this.shortcut && !this.matchcase) {
            this.patternShortcut = true;
            return;
        }

        // Rules like `/example/*` are rather often in the real-life filters,
        // we might want to process them.
        if (this.pattern.startsWith(this.shortcut)
            && this.pattern.length === this.shortcut.length + 1
            && this.pattern.endsWith('*')) {
            this.patternShortcut = true;
            return;
        }

        if (this.pattern.startsWith(SimpleRegex.MASK_START_URL)
            && this.pattern.endsWith(SimpleRegex.MASK_SEPARATOR)
            && this.pattern.indexOf('*') < 0
            && this.pattern.indexOf('/') < 0) {
            this.hostname = this.pattern.slice(2, this.pattern.length - 1);
            return;
        }

        this.compileRegex();
    }

    /**
     * Compiles this pattern regex.
     */
    private compileRegex(): void {
        const regexText = SimpleRegex.patternToRegexp(this.pattern);
        try {
            let flags = 'i';
            if (this.matchcase) {
                flags = '';
            }
            this.regex = new RegExp(regexText, flags);
        } catch (e) {
            this.regexInvalid = true;
        }
    }

    /**
     * Checks if we should match hostnames and not the URL
     * this is important for the cases when we use urlfilter for DNS-level blocking
     * Note, that even though we may work on a DNS-level, we should still sometimes match full URL instead.
     *
     * @param request Request to check.
     *
     * @returns True if the hostname should be matched.
     */
    private shouldMatchHostname(request: Request): boolean {
        if (!request.isHostnameRequest) {
            return false;
        }

        return !this.isPatternDomainSpecific();
    }

    /**
     * In case pattern starts with the following it targets some specific domain.
     *
     * @returns True if the pattern targets a specific domain.
     */
    public isPatternDomainSpecific(): boolean {
        if (this.patternDomainSpecific === undefined) {
            this.patternDomainSpecific = this.pattern.startsWith(SimpleRegex.MASK_START_URL)
                || this.pattern.startsWith('http://')
                || this.pattern.startsWith('https:/')
                || this.pattern.startsWith('://');
        }

        return this.patternDomainSpecific;
    }
}
