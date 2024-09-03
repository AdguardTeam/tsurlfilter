/**
 * Prefix tree implementation
 */
export class TrieNode {
    /**
     * This node's children could be
     * - undefined in case of no children
     * - an instance of TrieNode in case of lonely child
     * - a map where key is a character code and value is it's trie node.
    */
    private children: Map<number, TrieNode> | TrieNode | undefined;

    /**
     * Character code of this TrieNode.
     */
    private code: number;

    /**
     * Data, attached to this trie node. When trie traversal is being done,
     * data from all trie nodes is collected.
     */
    private data: number[] | undefined;

    /**
     * Creates an instance of a TrieNode with the specified char code.
     *
     * @param code
     */
    constructor(code: number) {
        this.code = code;
    }

    /**
     * Attaches data to this TrieNode.
     *
     * @param data
     */
    attach(data: number): void {
        if (!this.data) {
            this.data = [];
        }

        this.data.push(data);
    }

    /**
     * Adds the specified string to the Trie and attaches data to it.
     *
     * @param str string to add.
     * @param data data to attach to the leaf node.
     */
    public add(str: string, data: number): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let root: TrieNode = this;
        for (let i = 0; i < str.length; i += 1) {
            const c = str.charCodeAt(i);

            let next = root.getChild(c);
            if (!next) {
                next = root.addChild(c);
            }

            root = next;
        }
        root.attach(data);
    }

    /**
     * Traverses this TrieNode and it's children using the specified search string.
     * This method collects all the data that's attached on the way and returns as
     * a result.
     *
     * @param str string to check.
     * @param start index in str where to start traversing from.
     */
    traverse(str: string, start: number): number[] {
        const result: number[] = [];

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current: TrieNode = this;
        for (let i = start; i < str.length; i += 1) {
            const c = str.charCodeAt(i);
            const next = current.getChild(c);
            if (!next) {
                break;
            }
            if (next.data) {
                result.push(...next.data);
            }
            current = next;
        }

        return result;
    }

    /**
     * Traverses this TrieNode and it's children using the specified search string and all substrings.
     *
     * @param str string to check
     * @param len max length to check
     */
    public traverseAll(str: string, len: number): number[] {
        const data: number[] = [];
        for (let i = 0; i <= len; i += 1) {
            const result = this.traverse(str, i);
            if (result) {
                data.push(...result);
            }
        }

        return data;
    }

    /**
     * Returns a child node with the specified character code or
     * undefined if not found.
     *
     * @param code character code
     * @returns child node or undefined.
     */
    private getChild(code: number): TrieNode | undefined {
        const { children } = this;

        if (!children) {
            return undefined;
        }

        if (children instanceof TrieNode) {
            if (children.code === code) {
                return children;
            }
            return undefined;
        }

        return children.get(code);
    }

    /**
     * Adds a new child node with the specified character code.
     *
     * @param code character code.
     * @returns the newly created TrieNode.
     */
    private addChild(code: number): TrieNode {
        const node = new TrieNode(code);

        if (!this.children) {
            this.children = node;
        } else if (this.children instanceof TrieNode) {
            const oldNode = this.children;
            this.children = new Map();
            this.children.set(oldNode.code, oldNode);
            this.children.set(code, node);
        } else {
            this.children.set(code, node);
        }

        return node;
    }
}
