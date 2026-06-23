import { markDrawForClub, normalizeText } from "@/lib/bkplay/parser";
import { getProvinceByOrgId } from "@/lib/regions";
import type { ClubIndex, ClubIndexEntry, CrawlSnapshot, TournamentData, TournamentResult } from "@/lib/types";

export function normalizeClubSearchKey(value: string) {
  return normalizeText(value).normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function extractClubNamesFromTeamName(teamName: string) {
  return teamName
    .split(/[&＆]/)
    .map(normalizeText)
    .filter(Boolean);
}

export function filterClubIndexEntries(index: ClubIndex, clubName: string, provinceOrgId: string) {
  const key = normalizeClubSearchKey(clubName);
  const entries = index.clubs[key] || [];

  if (!provinceOrgId) return entries;
  return entries.filter((entry) => entry.provinceOrgId === provinceOrgId);
}

function mergeEntryDrawIds(entries: ClubIndexEntry[]) {
  const byTournament = new Map<string, Set<string>>();

  for (const entry of entries) {
    const drawIds = byTournament.get(entry.tournamentId) || new Set<string>();
    entry.drawIds.forEach((drawId) => drawIds.add(drawId));
    byTournament.set(entry.tournamentId, drawIds);
  }

  return byTournament;
}

export function annotateTournamentForClub(
  tournament: TournamentData,
  clubName: string,
  allowedDrawIds?: Set<string>
): TournamentResult | null {
  const draws = tournament.draws
    .filter((draw) => !allowedDrawIds || allowedDrawIds.has(draw.drawId))
    .map((draw) => markDrawForClub(draw, clubName))
    .filter((draw): draw is NonNullable<typeof draw> => Boolean(draw));

  if (draws.length === 0) return null;

  return {
    id: tournament.id,
    round: tournament.round,
    name: tournament.name,
    status: tournament.status,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    host: tournament.host,
    venue: tournament.venue,
    detailUrl: tournament.detailUrl,
    draws
  };
}

export function buildSnapshotFromStaticData(params: {
  generatedAt: string;
  clubName: string;
  provinceOrgId: string;
  index: ClubIndex;
  tournaments: TournamentData[];
  lookbackDays: number;
  lookaheadDays: number;
  errors?: string[];
}): CrawlSnapshot {
  const province = getProvinceByOrgId(params.provinceOrgId) || getProvinceByOrgId("");
  const entries = filterClubIndexEntries(params.index, params.clubName, params.provinceOrgId);
  const drawIdsByTournament = mergeEntryDrawIds(entries);
  const tournaments = params.tournaments
    .map((tournament) => annotateTournamentForClub(tournament, params.clubName, drawIdsByTournament.get(tournament.id)))
    .filter((tournament): tournament is TournamentResult => Boolean(tournament));
  const matchedDraws = tournaments.reduce((count, tournament) => count + tournament.draws.length, 0);

  return {
    refreshedAt: params.generatedAt,
    scope: {
      clubName: params.clubName,
      provinceOrgId: province?.orgId || "",
      provinceName: province?.name || "전체 지역",
      lookbackDays: params.lookbackDays,
      lookaheadDays: params.lookaheadDays
    },
    tournaments,
    stats: {
      scannedTournaments: params.tournaments.length,
      scannedCategories: 0,
      matchedTournaments: tournaments.length,
      matchedDraws,
      skippedNotPublished: 0
    },
    errors: params.errors || []
  };
}
