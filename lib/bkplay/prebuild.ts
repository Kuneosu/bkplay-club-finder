import { getAppConfig, type AppConfig } from "@/lib/config";
import { addDays, toBkplayDate } from "@/lib/date";
import { buildAreaListUrl, fetchBkplayHtml, toAbsoluteBkplayUrl } from "@/lib/bkplay/http";
import { parseCategories, parseQualifierDraw, parseQualifierGroupUrls, parseTournamentList } from "@/lib/bkplay/parser";
import { BKPLAY_PROVINCES, getProvinceByOrgId } from "@/lib/regions";
import { extractClubNamesFromTeamName, normalizeClubSearchKey } from "@/lib/static-search";
import type { ClubIndex, ClubIndexEntry, StaticDataManifest, TournamentData, TournamentSummary } from "@/lib/types";

const DEFAULT_PROVINCE_ORG_IDS = BKPLAY_PROVINCES.filter((province) => province.orgId && province.orgId !== "2283").map(
  (province) => province.orgId
);

export type StaticDataBuildResult = {
  manifest: StaticDataManifest;
  clubIndex: ClubIndex;
  tournaments: TournamentData[];
};

type PrebuildConfig = AppConfig & {
  provinceOrgIds: string[];
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readProvinceOrgIds() {
  const raw = process.env.BKPLAY_PROVINCE_ORG_IDS;
  if (!raw) return DEFAULT_PROVINCE_ORG_IDS;

  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "2283" || process.env.BKPLAY_INCLUDE_OVERSEAS === "true");

  return ids.length > 0 ? ids : DEFAULT_PROVINCE_ORG_IDS;
}

function createPrebuildConfig(): PrebuildConfig {
  return {
    ...getAppConfig(),
    provinceOrgIds: readProvinceOrgIds()
  };
}

function uniqueById(tournaments: TournamentSummary[]) {
  const map = new Map<string, TournamentSummary>();
  for (const tournament of tournaments) {
    map.set(tournament.id, tournament);
  }
  return [...map.values()];
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    })
  );

  return results;
}

async function fetchWithDelay(url: string, config: AppConfig) {
  if (config.requestDelayMs > 0) {
    await delay(config.requestDelayMs);
  }
  return fetchBkplayHtml(url);
}

async function loadTournamentListForProvince(
  provinceOrgId: string,
  config: AppConfig,
  errors: string[],
  now = new Date()
) {
  const searchStartDate = toBkplayDate(addDays(now, -config.lookbackDays));
  const searchEndDate = toBkplayDate(addDays(now, config.lookaheadDays));
  const tournaments: TournamentSummary[] = [];
  let totalPages = 1;

  for (let pageNo = 1; pageNo <= Math.min(totalPages, config.maxPages); pageNo += 1) {
    const url = buildAreaListUrl({
      pageNo,
      pageRowCnt: 10,
      provinceOrgId,
      searchStartDate,
      searchEndDate
    });

    try {
      const html = await fetchWithDelay(url, config);
      const parsed = parseTournamentList(html);
      totalPages = parsed.totalPages || totalPages;
      tournaments.push(...parsed.tournaments);
    } catch (error) {
      errors.push(
        `${getProvinceByOrgId(provinceOrgId)?.name || provinceOrgId} 대회 목록 ${pageNo}페이지 수집 실패: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return uniqueById(tournaments).slice(0, config.maxTournaments);
}

async function collectTournamentData(params: {
  tournament: TournamentSummary;
  provinceOrgId: string;
  provinceName: string;
  config: AppConfig;
  errors: string[];
  scannedCategoryRef: { value: number };
}): Promise<TournamentData | null> {
  const { tournament, provinceOrgId, provinceName, config, errors, scannedCategoryRef } = params;
  const categoryUrl = toAbsoluteBkplayUrl(`/tournament/getSelectedPlayingCategory?tnmtId=${tournament.id}&typeCode=PERSONAL`);
  let categoryHtml = "";

  try {
    categoryHtml = await fetchWithDelay(categoryUrl, config);
  } catch (error) {
    errors.push(`${tournament.name} 종목 목록 수집 실패: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  const categories = parseCategories(categoryHtml, tournament.id);
  if (categories.length === 0) return null;

  const remainingCategoryCount = config.maxCategories - scannedCategoryRef.value;
  if (remainingCategoryCount <= 0) return null;

  const categoriesToScan = categories.slice(0, remainingCategoryCount);
  scannedCategoryRef.value += categoriesToScan.length;
  if (categories.length > categoriesToScan.length) {
    errors.push(`최대 종목 수(${config.maxCategories})에 도달해 일부 종목 수집을 건너뛰었습니다.`);
  }

  const drawGroups = await mapWithConcurrency(categoriesToScan, config.categoryConcurrency, async (category) => {
    const parsedDraws: NonNullable<ReturnType<typeof parseQualifierDraw>>[] = [];
    let firstHtml = "";

    try {
      firstHtml = await fetchWithDelay(category.sourceUrl, config);
    } catch (error) {
      errors.push(`${tournament.name} ${category.title} 대진 수집 실패: ${error instanceof Error ? error.message : String(error)}`);
      return parsedDraws;
    }

    const groupUrls = parseQualifierGroupUrls(firstHtml);
    const urls = groupUrls.length > 0 ? [category.sourceUrl, ...groupUrls] : [category.sourceUrl];
    const uniqueUrls = [...new Set(urls)];

    const categoryDraws = await mapWithConcurrency(uniqueUrls, config.categoryConcurrency, async (sourceUrl, index) => {
      try {
        const html = index === 0 ? firstHtml : await fetchWithDelay(sourceUrl, config);
        return parseQualifierDraw({
          html,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          tournamentStatus: tournament.status,
          tournamentStartDate: tournament.startDate,
          tournamentEndDate: tournament.endDate,
          tournamentVenue: tournament.venue,
          category: {
            ...category,
            sourceUrl
          }
        });
      } catch (error) {
        errors.push(
          `${tournament.name} ${category.title} 조별 대진 수집 실패: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    });

    for (const draw of categoryDraws) {
      if (draw) parsedDraws.push(draw);
    }

    return parsedDraws;
  });

  const drawMap = new Map<string, TournamentData["draws"][number]>();
  drawGroups.flat().forEach((draw) => {
    drawMap.set(draw.drawId, draw);
  });

  const draws = [...drawMap.values()];
  if (draws.length === 0) return null;

  return {
    ...tournament,
    provinceOrgId,
    provinceName,
    draws
  };
}

function addClubIndexEntry(index: Map<string, ClubIndexEntry[]>, clubName: string, entry: ClubIndexEntry) {
  const key = normalizeClubSearchKey(clubName);
  const entries = index.get(key) || [];
  const existing = entries.find((item) => item.tournamentId === entry.tournamentId && item.detailPath === entry.detailPath);

  if (existing) {
    entry.drawIds.forEach((drawId) => {
      if (!existing.drawIds.includes(drawId)) existing.drawIds.push(drawId);
    });
  } else {
    entries.push(entry);
  }

  index.set(key, entries);
}

export function buildClubIndex(tournaments: TournamentData[], generatedAt: string): ClubIndex {
  const index = new Map<string, ClubIndexEntry[]>();

  tournaments.forEach((tournament) => {
    const detailPath = `/data/tournaments/${tournament.id}.json`;

    tournament.draws.forEach((draw) => {
      draw.standings.forEach((standing) => {
        extractClubNamesFromTeamName(standing.teamName).forEach((clubName) => {
          addClubIndexEntry(index, clubName, {
            clubName,
            provinceOrgId: tournament.provinceOrgId,
            provinceName: tournament.provinceName,
            tournamentId: tournament.id,
            drawIds: [draw.drawId],
            detailPath
          });
        });
      });
    });
  });

  return {
    generatedAt,
    clubs: Object.fromEntries([...index.entries()].sort(([left], [right]) => left.localeCompare(right, "ko")))
  };
}

export async function buildStaticData(options?: { now?: Date; config?: PrebuildConfig }): Promise<StaticDataBuildResult> {
  const config = options?.config || createPrebuildConfig();
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const scannedCategoryRef = { value: 0 };
  const tournamentMap = new Map<string, TournamentData>();
  let scannedTournaments = 0;

  for (const provinceOrgId of config.provinceOrgIds) {
    const province = getProvinceByOrgId(provinceOrgId);
    if (!province) {
      errors.push(`지원하지 않는 지역 ID입니다: ${provinceOrgId}`);
      continue;
    }

    const tournamentList = await loadTournamentListForProvince(provinceOrgId, config, errors, options?.now);
    scannedTournaments += tournamentList.length;

    for (const tournament of tournamentList) {
      const data = await collectTournamentData({
        tournament,
        provinceOrgId: province.orgId,
        provinceName: province.name,
        config,
        errors,
        scannedCategoryRef
      });

      if (data && !tournamentMap.has(data.id)) {
        tournamentMap.set(data.id, data);
      }
    }
  }

  const tournaments = [...tournamentMap.values()].sort((left, right) => {
    const leftDate = left.startDate || "";
    const rightDate = right.startDate || "";
    return rightDate.localeCompare(leftDate) || right.id.localeCompare(left.id);
  });
  const clubIndex = buildClubIndex(tournaments, generatedAt);
  const drawCount = tournaments.reduce((count, tournament) => count + tournament.draws.length, 0);

  return {
    manifest: {
      generatedAt,
      scope: {
        provinceOrgIds: config.provinceOrgIds,
        lookbackDays: config.lookbackDays,
        lookaheadDays: config.lookaheadDays,
        maxPages: config.maxPages,
        maxTournaments: config.maxTournaments,
        maxCategories: config.maxCategories
      },
      stats: {
        tournamentCount: tournaments.length,
        drawCount,
        clubCount: Object.keys(clubIndex.clubs).length,
        scannedTournaments,
        scannedCategories: scannedCategoryRef.value
      },
      errors
    },
    clubIndex,
    tournaments
  };
}
