import { ByteBuffer } from './byte-buffer';
import { BinaryFst } from './binary-fst-test';

// 1) Prepare your key-value pairs (string -> number). They should be sorted if you want naive merging:
const entries: Array<[string, number]> = [
  ['abc', 100],
  ['abd', 101],
  ['bca', 102],
  ['zzz', 999],
];

// 2) Create a ByteBuffer and build the FST:
const buffer = new ByteBuffer();
const fstOffset = BinaryFst.create(entries, buffer);

// 3) Lookup values:
console.log(BinaryFst.get('abc', buffer, fstOffset)); // 100
console.log(BinaryFst.get('abd', buffer, fstOffset)); // 101
console.log(BinaryFst.get('zzz', buffer, fstOffset)); // 999
console.log(BinaryFst.get('notfound', buffer, fstOffset)); // undefined

// Below is a simplified Finite State Transducer (FST)–like implementation in TypeScript that builds on the same ideas as your BinaryMap, BinaryTrie, and ByteBuffer utilities. This example shows how to:

//     Build a trie-based structure from a set of (string → number) pairs.
//     Optionally apply basic minimization to reduce redundant trie branches (a simplified approach compared to a full minimal DFA-based FST).
//     Write the resulting structure into a ByteBuffer in a layout similar to your existing BinaryTrie.
//     Provide a read-only API to look up integer values based on a string key.

//     Important note
//     A fully featured FST (e.g., LOUDS-Dense + LOUDS-Sparse or full minimal DFA creation) is quite extensive. This sample focuses on the core ideas of storing a trie-like structure in a ByteBuffer, with minimal node merging for demonstration. You can expand it to a more advanced approach (e.g., advanced minimal perfect hashing, LOUDS-based navigation, or sophisticated merges) if needed.



// Explanation

//     FstNode
//     A small class representing a node in our trie-like FST.
//         finalOutput: If the node represents the end of a key, store an integer. Otherwise, null.
//         children: A Map<number, FstNode> keyed by character code.

//     buildTrie()
//     Constructs a naive trie from sorted [string, number] pairs.

//     mergeSubtries()
//     A very basic attempt at trie minimization. We generate a string signature for each node based on its finalOutput and the identities of its sorted children. If two nodes share the same signature, they are merged.

//     writeNode()
//     Encodes each node into the ByteBuffer in a depth-first manner:
//         finalOutputOrEmpty (4 bytes): 0 if not final, otherwise the integer value.
//         numberOfChildren (4 bytes)
//         Child records (5 bytes each): [1 byte: childChar, 4 bytes: childOffset]
//         Recursively writes each child, then fills in the child offset in the parent’s record.

//     get()
//     Reads the final output of the string if it exists by traversing the stored structure in the buffer.
//         Repeatedly:
//             Skip over finalOutput and numberOfChildren.
//             Scan the child entries (or do a binary search) to find the matching character code.
//         If at any point the child is not found, return undefined.
//         If we finish the entire key, we check the node’s finalOutput. If it’s 0, not final; else return its value.

// Further Improvements

//     Full Minimization
//     Implement a proper minimal DFA-based FST builder with advanced merges (e.g., hashing child lists).
//     LOUDS-Sparse/LOUDS-Dense
//     Instead of the above node layout, store the trie via LOUDS for more compact representations and constant-time navigations.
//     Binary Search in Child Records
//     For large alphabets or many children, searching child edges via binary search is more efficient than a simple loop.
//     Key-Value Output
//     If you need to store multiple values or more complex objects, adapt the finalOutput to store offsets into a U32LinkedList or a separate structure.

// This code should serve as a starting point for an FST-like approach compatible with your existing ByteBuffer system. Feel free to adapt, refine, and optimize as your use case requires.

