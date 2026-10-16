import { z } from "zod";

const cardSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  data_id: z.union([z.string(), z.number()]).optional().transform(v => v == null ? undefined : String(v)),
  poster: z.string().optional(),
  title: z.string().default("Untitled"),
  jname: z.string().optional(),
  url: z.string().optional(),
  tvInfo: z.object({
    showType: z.string().optional(),
    sub: z.coerce.number().optional(),
    dub: z.coerce.number().optional(),
    eps: z.coerce.number().optional(),
  }).optional(),
  adultContent: z.boolean().optional(),
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
export const seriesSchema = z.object({
  slug: z.string().optional(),
  series_id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  native: z.string().optional(),
  poster: z.string().optional(),
  description: z.string().optional(),
  score: z.union([z.string(), z.number()]).optional(),
  mal_id: z.union([z.string(), z.number()]).optional(),
  ani_id: z.union([z.string(), z.number()]).optional(),
  background_image: z.string().optional(),
  status: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  language_availability: z.object({
    sub_episodes: z.coerce.number().optional().default(0),
    dub_episodes: z.coerce.number().optional().default(0),
  }).optional().default({ sub_episodes: 0, dub_episodes: 0 }),
}).passthrough();

export type RawAnimeCard = z.infer<typeof cardSchema>;
