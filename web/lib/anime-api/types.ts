export type AnimeCard = {
  id: string;
  dataId?: string;
  slug: string;
  title: string;
  jname?: string;
  poster?: string;
  showType?: string;
  sub?: number;
  dub?: number;
  episodes?: number;
  adultContent?: boolean;
};

export type HomePayload = {
  meta?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  navigation: {
    genres: Array<{ name: string; slug: string }>;
    types: Array<{ name: string; slug: string }>;
  };
  sections: {
    hotest: AnimeCard[];
    latestEpisode: AnimeCard[];
    upcomingAnime: AnimeCard[];
  };
};

export type SeriesPayload = {
  slug: string;
  seriesId?: string;
  title: string;
  native?: string;
  poster?: string;
  description?: string;
  score?: string | number;
  malId?: string | number;
  aniId?: string | number;
  backgroundImage?: string;
  status?: string;
  year?: number | string;
  duration?: string | number;
  languageAvailability: {
    subEpisodes: number;
    dubEpisodes: number;
  };
};

export type GenrePayload = {
  items: AnimeCard[];
  page: number;
  hasNextPage?: boolean;
};
