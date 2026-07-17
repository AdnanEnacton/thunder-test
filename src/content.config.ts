import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.{md,mdx}",
  }),

  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    category: z.string(),
  }),
});

const videoLibrary = defineCollection({
  loader: glob({
    base: "./src/content/video-library",
    pattern: "**/*.{md,mdx}",
  }),

  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    watch: z.number(),
  }),
});

const pages = defineCollection({
  loader: glob({
    base: "./src/content/pages",
    pattern: "**/*.md",
  }),

  schema: z.object({
    title: z.string(),
    type: z.literal("component"),
    blocks: z.array(z.record(z.string(), z.unknown())),
  }),
});

export const collections = {
  blog,
  videoLibrary,
  pages,
};