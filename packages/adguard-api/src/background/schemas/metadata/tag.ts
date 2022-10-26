import zod from "zod";

export const tagMetadataValidator = zod.object({
    tagId: zod.number(),
    keyword: zod.string(),
    description: zod.string().optional(),
    name: zod.string().optional(),
});

export type TagMetadata = zod.infer<typeof tagMetadataValidator>;
