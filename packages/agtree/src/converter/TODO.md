# TODO list for the converter

- [x] Implement `RuleConverter.convertToAdg` method
- [ ] Implement `RuleConverter.convertToAbp` method
- [ ] Implement `RuleConverter.convertToUbo` method
- [ ] Replace cloneDeep with a more efficient solution
- [ ] Add `zod` schemas for the AST nodes
- [ ] Implement custom cloning function for each AST node
- [ ] Implement "raw" converter interface, which wraps the AST-based converter, but calls parser before the conversion
and calls the serializer after the conversion.
- [ ] Add "tolerant" mode to the filter list converter
    - If one of the rules in the filter list cannot be converted, the converter throws an error which breaks the
    conversion of the whole filter list. In tolerant mode, the converter should skip the invalid rule and continue
    with the next one.
