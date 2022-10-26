import zod from "zod";
import { SchemaPreprocessor } from "../preprocessor";

export const filterVersionDataValidator = zod.object({
    version: zod.string(),
    lastCheckTime: zod.number(),
    lastUpdateTime: zod.number(),
    expires: zod.number(),
});

export type FilterVersionData = zod.infer<typeof filterVersionDataValidator>;

export const filterVersionStorageDataValidator = zod.record(
    SchemaPreprocessor.numberValidator,
    filterVersionDataValidator
);

export type FilterVersionStorageData = zod.infer<typeof filterVersionStorageDataValidator>;
