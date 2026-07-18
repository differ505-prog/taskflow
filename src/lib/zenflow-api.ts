// 從 OmniSonic API 取得的曲目型別（只取 CEO Deep Focus 85 BPM）
export type ZenFlowTrack = {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  durationSeconds: number;
  descriptionZh: string;
  descriptionEn: string;
  audioUrl: string;
};

// OmniSonic 部署 URL
// 請在 .env.local 中設定 NEXT_PUBLIC_OMNISONIC_URL
// 例如 Vercel 部署後：https://music-focus-environment.vercel.app
// 部署前本機開發可設為 http://localhost:3000
const OMNISONIC_BASE_URL =
  (process.env.NEXT_PUBLIC_OMNISONIC_URL as string | undefined) ?? "";

async function fetchZenFlowTracks(): Promise<ZenFlowTrack[]> {
  if (!OMNISONIC_BASE_URL) return [];

  const res = await fetch(`${OMNISONIC_BASE_URL}/api/zenflow/tracks`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { tracks: ZenFlowTrack[] };
  return data.tracks ?? [];
}

export { fetchZenFlowTracks, OMNISONIC_BASE_URL };
