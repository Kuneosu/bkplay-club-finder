import { getProvinceByOrgId } from "@/lib/regions";

export type AppConfig = {
  clubName: string;
  provinceOrgId: string;
  provinceName: string;
  lookbackDays: number;
  lookaheadDays: number;
  maxPages: number;
  maxTournaments: number;
  maxCategories: number;
  categoryConcurrency: number;
  requestDelayMs: number;
  refreshTimesKst: string[];
};

function readNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readList(name: string, fallback: string[]) {
  const value = process.env[name];
  if (!value) return fallback;

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

export function getAppConfig(): AppConfig {
  const envProvinceOrgId = process.env.BKPLAY_PROVINCE_ORG_ID || "3";
  const province = getProvinceByOrgId(envProvinceOrgId) || getProvinceByOrgId("3");

  return {
    clubName: process.env.BKPLAY_CLUB_NAME || "마코클럽",
    provinceOrgId: province?.orgId || "3",
    provinceName: province?.name || "부산",
    lookbackDays: readNumber("BKPLAY_LOOKBACK_DAYS", 30),
    lookaheadDays: readNumber("BKPLAY_LOOKAHEAD_DAYS", 30),
    maxPages: readNumber("BKPLAY_MAX_PAGES", 12),
    maxTournaments: readNumber("BKPLAY_MAX_TOURNAMENTS", 120),
    maxCategories: readNumber("BKPLAY_MAX_CATEGORIES", 10000),
    categoryConcurrency: readNumber("BKPLAY_CATEGORY_CONCURRENCY", 8),
    requestDelayMs: readNumber("BKPLAY_REQUEST_DELAY_MS", 40),
    refreshTimesKst: readList("BKPLAY_REFRESH_TIMES_KST", ["10:00", "14:00", "18:00"])
  };
}
