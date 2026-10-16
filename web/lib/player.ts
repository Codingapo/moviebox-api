export type AudioMode = "sub" | "dub";
const PLAYER_BASE = "https://supaplay.fun";

export function classicPlayer(episodeEmbedId: string, mode: AudioMode) {
  return `${PLAYER_BASE}/stream/s-2/${encodeURIComponent(episodeEmbedId)}/${mode}`;
}

export function anilistPlayer(anilistId: string | number, episode: number, mode: AudioMode) {
  return `${PLAYER_BASE}/stream/ani/${encodeURIComponent(String(anilistId))}/${episode}/${mode}`;
}

export function mwPlayer(detailPath: string, season: number, episode: number) {
  return `${PLAYER_BASE}/mw/${encodeURIComponent(detailPath)}/${season}/${episode}`;
}
