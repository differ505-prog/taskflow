// OmniSonic 部署 URL
// 請在 .env.local 中設定 NEXT_PUBLIC_OMNISONIC_URL
// 例如 Vercel 部署後：https://music-focus-environment.vercel.app
// 部署前本機開發可設為 http://localhost:3000
const OMNISONIC_BASE_URL =
  (process.env.NEXT_PUBLIC_OMNISONIC_URL as string | undefined) ?? "";

// ── OmniSonic new Auto DJ endpoint types ──────────────────────────

export type OmniSonicTransition = {
  introCueSeconds: number;
  outroMixWindowSeconds: number;
  crossfadeSeconds: number;
  targetGain: number;
  sourceLufs: number;
  targetLufs: number;
  normalizationGainDb: number;
  fadeCurve: "equal_power";
  tempoLockBars: number;
  beatDurationSeconds: number;
  mixInPointSeconds: number;
  mixOutPointSeconds: number;
};

export type OmniSonicMedia = {
  audioUrl: string;
  coverImageUrl: string;
  backgroundVideoUrl: string;
};

export type OmniSonicCopy = {
  descriptionZh: string;
  descriptionEn: string;
  themeScenario: string;
};

/** 從 OmniSonic /autodj/playlist 取得的完整曲目（含 transition/cue metadata） */
export type OmniSonicTrack = {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  durationSeconds: number;
  musicalKey: string;
  energyLevel: number;
  moodTags: string[];
  status: string;
  media: OmniSonicMedia;
  copy: OmniSonicCopy;
  transition: OmniSonicTransition;
  featured?: boolean;
  createdAt: string;
};

/** Alias for backward compat */
export type ZenFlowTrack = OmniSonicTrack;

export type OmniSonicTrackPlan = {
  trackId: string;
  order: number;
  phase: "opening" | "lock" | "lift" | "glide";
  phaseLabel: string;
  phaseDescription: string;
  transitionSummary: string;
};

export type OmniSonicSessionPlan = {
  orderedTrackIds: string[];
  laneLabel: string;
  strategySummary: string;
  currentTrackIndex: number;
  currentPhase: "opening" | "lock" | "lift" | "glide" | null;
  currentPhaseLabel: string;
  currentPhaseDescription: string;
  mixBrief: string;
  nextTransitionSummary: string;
  trackPlans: OmniSonicTrackPlan[];
};

export type AutoDjPlaylistResponse = {
  tracks: OmniSonicTrack[];
  sessionPlan: OmniSonicSessionPlan;
  generatedAt: string;
};

// ── API fetchers ─────────────────────────────────────────────────

async function fetchZenFlowTracks(): Promise<ZenFlowTrack[]> {
  if (!OMNISONIC_BASE_URL) return [];

  const res = await fetch(`${OMNISONIC_BASE_URL}/api/zenflow/tracks`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { tracks: ZenFlowTrack[] };
  return data.tracks ?? [];
}

/** 從 OmniSonic Auto DJ endpoint 取得完整曲目清單（含 cue/crossfade metadata） */
async function fetchAutoDjPlaylist(params?: {
  currentTrackId?: string | null;
  nextTrackId?: string | null;
}): Promise<AutoDjPlaylistResponse | null> {
  if (!OMNISONIC_BASE_URL) return null;

  const sp = new URLSearchParams();
  if (params?.currentTrackId) sp.set("currentTrackId", params.currentTrackId);
  if (params?.nextTrackId) sp.set("nextTrackId", params.nextTrackId);
  const qs = sp.toString();

  const res = await fetch(
    `${OMNISONIC_BASE_URL}/api/zenflow/autodj/playlist${qs ? `?${qs}` : ""}`,
    { next: { revalidate: 10 } },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as AutoDjPlaylistResponse;
  return data;
}

export { fetchZenFlowTracks, fetchAutoDjPlaylist, OMNISONIC_BASE_URL };
