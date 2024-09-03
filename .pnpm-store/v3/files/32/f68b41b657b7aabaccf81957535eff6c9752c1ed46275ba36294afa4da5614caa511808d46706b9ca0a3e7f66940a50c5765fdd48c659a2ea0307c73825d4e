/** The CSS state represents the condition of the tokenizer at any given moment. */
export type CSSState = {
	/** CSS data. */
	data: string
	/** Number of characters in the CSS data. */
	size: number
	/** Current position in the CSS data. */
	tick: number
	/** Unicode character for the current position in the CSS data. */
	codeAt0: number
	/** Unicode character for the 1 ahead position in the CSS data. */
	codeAt1: number
	/** Unicode character for the 2 ahead position in the CSS data. */
	codeAt2: number
	/** Unicode character for the 3 ahead position in the CSS data. */
	codeAt3: number
	/** Advances the unicode characters being read from the CSS data by one position. */
	next(): boolean
}

/** The CSS iterator produces a sequence of CSS tokens in an iterator pattern. */
export type CSSIterator = {
	(): CSSIteration
	[Symbol.iterator](): {
		next: CSSIterator
	}
}

/** The CSS iteration represents the most recent state and token yielded from the CSS iterator. */
export type CSSIteration = {
	done: boolean
	value: CSSToken
}

export type CSSToken = {
	tick: number
	type: number
	code: number
	lead: string
	data: string
	tail: string
}

export type CSSTokenize = (data: string) => CSSIterator

export declare const tokenize: CSSTokenize
