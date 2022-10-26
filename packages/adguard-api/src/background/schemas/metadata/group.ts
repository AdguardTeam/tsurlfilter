import zod from "zod";

export const groupMetadataValidator = zod.object({
    displayNumber: zod.number(),
    groupId: zod.number(),
    groupName: zod.string(),
});

export type GroupMetadata = zod.infer<typeof groupMetadataValidator>;
