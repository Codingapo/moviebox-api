import { z } from "zod";

const idValue = z.union([z.string(), z.number()]);

export const cardSchema = z.object({
  id: idValue.optional(),
  data_id: idValue.optional(),
  slug: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  jname: z.string().optional().nullable(),
  japaneseTitle: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  tvInfo: z.object({
    showType: z.string().optional().nullable(),
    sub: z.union([z.string(), z.number()]).optional().nullable(),
    dub: z.union([z.string(), z.number()]).optional().nullable(),
    eps: z.union([z.string(), z.number()]).optional().nullable(),
  }).optional().nullable(),
  episodes: z.union([
    z.object({
      sub: z.union([z.string(), z.number()]).optional().nullable(),
      dub: z.union([z.string(), z.number()]).optional().nullable(),
      total: z.union([z.string(), z.number()]).optional().nullable(),
    }).passthrough(),
    z.string(),
    z.number(),
    z.null(),
  ]).optional(),
  adultContent: z.boolean().optional(),
  isAdult: z.boolean().optional(),
}).passthrough();

export const homeSchema = z.object({
  meta: z.record(z.any()).optional(),
  navigation: z.object({
    genres: z.array(z.any()).optional().default([]),
    types: z.array(z.any()).optional().default([]),
  }).optional().default({ genres: [], types: [] }),
  sections: z.object({
    hotest: z.array(cardSchema).optional().default([]),
    latestEpisode: z.array(cardSchema).optional().default([]),
    upcomingAnime: z.array(cardSchema).optional().default([]),
  }).optional().default({ hotest: [], latestEpisode: [], upcomingAnime: [] }),
}).passthrough();

export const genreSchema = z.any();
export const seriesSchema = z.any();

export type RawAnimeCard = z.infer<typeof cardSchema>;
