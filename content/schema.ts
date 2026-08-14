import { z } from "zod";

const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)+$/);
const promptSchema = z.object({ id: stableId, question: z.string().min(4) });
const artifactFieldSchema = z.object({ id: stableId, label: z.string().min(2) });

const baseChapter = z.object({
  id: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  slug: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  order: z.number().int().min(1).max(18),
  title: z.string().min(2),
});

const awaitingChapter = baseChapter.extend({ status: z.literal("awaiting_audio") }).strict();
const publishedChapter = baseChapter.extend({
  status: z.literal("published"),
  problem: z.string().min(20),
  oneSentence: z.string().min(10),
  coreStructure: z.array(z.object({ title: z.string(), body: z.string() })).min(2),
  explanation: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
  concepts: z.array(z.object({ term: z.string(), meaning: z.string() })).min(1),
  scenarios: z.array(z.string().min(6)).min(1),
  misconceptions: z.array(z.string().min(6)).min(1),
  reflectionPrompts: z.array(promptSchema).min(1),
  actionPrompt: promptSchema,
  artifactTemplate: z.object({
    title: z.string().min(2),
    fields: z.tuple([
      artifactFieldSchema,
      artifactFieldSchema,
      artifactFieldSchema,
      artifactFieldSchema,
    ]),
  }),
  reviewPrompts: z.tuple([promptSchema, promptSchema, promptSchema]),
});

export const chapterSchema = z.discriminatedUnion("status", [
  awaitingChapter,
  publishedChapter,
]);
export type ChapterDefinition = z.infer<typeof chapterSchema>;
export type ChapterStatus = ChapterDefinition["status"];
