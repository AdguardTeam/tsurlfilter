import { SimpleRegex } from '../src/simple-regex'

describe('SimpleRegex.patternToRegexp', () => {
    it('works if simple pattern is transformed properly', () => {
        const regex = SimpleRegex.patternToRegexp('||example.org^')
        const expected = SimpleRegex.REGEX_START_URL + 'example\\.org' + SimpleRegex.REGEX_SEPARATOR
        expect(regex).toEqual(expected)
    })

    it('works if pipes are transformed properly', () => {
        const regex = SimpleRegex.patternToRegexp('|https://example.org|')
        const expected =
            SimpleRegex.REGEX_START_STRING +
            'https:\\/\\/example\\.org' +
            SimpleRegex.REGEX_END_STRING
        expect(regex).toEqual(expected)
    })

    it('works if separator and any characters are transformed properly', () => {
        const regex = SimpleRegex.patternToRegexp('|https://example.org/[*]^')
        const expected =
            SimpleRegex.REGEX_START_STRING +
            'https:\\/\\/example\\.org\\/\\[' +
            SimpleRegex.REGEX_ANY_CHARACTER +
            '\\]' +
            SimpleRegex.REGEX_SEPARATOR
        expect(regex).toEqual(expected)
    })

    it('works if regex pattern is properly transformed', () => {
        const regex = SimpleRegex.patternToRegexp('/(example)+\\.org/')
        const expected = '(example)+\\.org'
        expect(regex).toEqual(expected)
    })
})
