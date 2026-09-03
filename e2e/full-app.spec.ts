import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const RUN_ID = process.env.PLAYWRIGHT_RUN_ID || "local";
const EVIDENCE_ROOT = path.join(process.cwd(), "output", "playwright", "runs", RUN_ID);
const SCREENSHOT_DIR = path.join(EVIDENCE_ROOT, "screenshots");
const SEARCH_CLUB = "마코클럽";
const PROVINCE_BUSAN = "3";
const TOURNAMENT_TITLE = "제2회 수영구배드민턴협회 여성부 대회";

function monitorRuntime(page: Page) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (text.includes("Failed to load resource: the server responded with a status of 404")) {
        return;
      }
      runtimeErrors.push(`console: ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });

  return async () => {
    expect(runtimeErrors).toEqual([]);
  };
}

async function saveScreenshot(page: Page, name: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: true
  });
}

async function performSearch(page: Page, clubName = SEARCH_CLUB, provinceOrgId = PROVINCE_BUSAN) {
  await page.getByLabel("지역").selectOption(provinceOrgId);
  await page.getByLabel("클럽명").fill(clubName);
  await page.getByRole("button", { name: "조회" }).click();
}

async function searchMakoClub(page: Page) {
  await performSearch(page);
  await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toBeVisible();
}

test.describe("QUICK-BK 전체 앱 E2E", () => {
  test("TC-001 TC-002 홈 진입 smoke와 초기 입력값 비움 회귀를 검증한다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "클럽 대진표 조회" })).toBeVisible();
    await expect(page.getByLabel("지역")).toHaveValue("");
    await expect(page.getByLabel("클럽명")).toHaveValue("");
    await expect(page.getByText("클럽명을 입력하고 조회해 주세요.")).toBeVisible();
    await expect(page.getByText("BKPLAY 기준 · 매일 3회 갱신")).toBeVisible();
    await saveScreenshot(page, "TC-001-TC-002-home-initial.png");
    await assertNoRuntimeErrors();
  });

  test("TC-003 빈 클럽명 조회 시 validation notice를 표시한다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page.getByText("클럽명을 입력해 주세요.")).toBeVisible();
    await expect(page.getByText("클럽명을 입력하고 조회해 주세요.")).toBeVisible();
    await saveScreenshot(page, "TC-003-empty-club-validation.png");
    await assertNoRuntimeErrors();
  });

  test("TC-004 TC-008 부산 마코클럽 검색 결과와 대회 목록 카드 정보를 표시한다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await searchMakoClub(page);

    await expect(page.getByText("조회 클럽").locator("..").getByText(SEARCH_CLUB)).toBeVisible();
    await expect(page.getByText("발견 대회").locator("..").getByText("1")).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toContainText("수영구민센터-민락");
    await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toContainText("상세 보기");
    await saveScreenshot(page, "TC-004-TC-008-search-results.png");
    await assertNoRuntimeErrors();
  });

  test("TC-005 결과 없는 클럽 조회 시 empty state를 표시한다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await performSearch(page, "없는클럽자동화테스트", PROVINCE_BUSAN);

    await expect(page.getByText("조건에 맞는 대진이 없습니다.")).toBeVisible();
    await expect(page.getByText("발견 대회").locator("..").getByText("0")).toBeVisible();
    await saveScreenshot(page, "TC-005-no-results.png");
    await assertNoRuntimeErrors();
  });

  test("TC-007 상태 필터를 전환하면 목록 결과가 기준에 맞게 바뀐다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await searchMakoClub(page);

    const statusFilter = page.getByLabel("대회 상태 필터");
    await statusFilter.getByRole("button", { name: "예정·진행" }).click();
    await expect(page.getByText("조건에 맞는 대진이 없습니다.")).toBeVisible();

    await statusFilter.getByRole("button", { name: "종료" }).click();
    await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toBeVisible();

    await statusFilter.getByRole("button", { name: "전체" }).click();
    await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toBeVisible();
    await saveScreenshot(page, "TC-007-status-filter.png");
    await assertNoRuntimeErrors();
  });

  test("TC-009 대회 상세 진입 후 대회 목록으로 브라우저 history를 유지해 복귀한다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await searchMakoClub(page);
    await page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) }).click();

    await expect(page).toHaveURL(/tournament=3879/);
    await expect(page.getByRole("heading", { name: TOURNAMENT_TITLE })).toBeVisible();
    await expect(page.getByText(`${SEARCH_CLUB} 출전자`)).toBeVisible();
    await saveScreenshot(page, "TC-009-detail-view.png");

    await page.getByRole("button", { name: "대회 목록" }).click();
    await expect(page).not.toHaveURL(/tournament=3879/);
    await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toBeVisible();
    await saveScreenshot(page, "TC-009-back-to-list.png");
    await assertNoRuntimeErrors();
  });

  test("TC-010 query 포함 진입 후 새 검색을 실행하면 목록 상태로 안전하게 정리된다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/?tournament=3879");
    await expect(page).toHaveURL(/tournament=3879/);

    await searchMakoClub(page);

    await expect(page).not.toHaveURL(/tournament=3879/);
    await expect(page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) })).toBeVisible();
    await saveScreenshot(page, "TC-010-query-search-reset.png");
    await assertNoRuntimeErrors();
  });

  test("TC-011 상세 대진을 펼치면 대진표와 경기 시간·코트·상대 정보가 보인다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await searchMakoClub(page);
    await page.getByRole("button", { name: new RegExp(TOURNAMENT_TITLE) }).click();
    await page.getByRole("button", { name: /여복 10,20대,30대 D/ }).click();

    await expect(page.getByRole("heading", { name: "대진표", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "경기 일정" })).toBeVisible();
    const drawMatrix = page.locator(".draw-matrix");
    await expect(drawMatrix.getByText("09:30").first()).toBeVisible();
    await expect(drawMatrix.getByText("4코트").first()).toBeVisible();
    await expect(drawMatrix.getByText("7번").first()).toBeVisible();
    const matchList = page.locator(".match-list");
    await expect(matchList.getByText("10:15").first()).toBeVisible();
    await expect(matchList.getByText("4코트").first()).toBeVisible();
    await expect(matchList.getByText(/수영구스포츠클럽&마코클럽/).first()).toBeVisible();
    await expect(matchList.getByText(/노은아 \/ 이혜미/).first()).toBeVisible();
    await saveScreenshot(page, "TC-011-draw-expanded.png");
    await assertNoRuntimeErrors();
  });

  test("TC-012 데이터 안내를 열면 수집 기준과 통계가 표시된다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await page.getByText("데이터 안내").click();

    const dataPanel = page.getByLabel("수집 데이터 정보");
    await expect(dataPanel.getByText("BKPLAY 지역별 대회정보")).toBeVisible();
    await expect(dataPanel.getByText(/대회 [\d,]+개 · 대진 [\d,]+개 · 클럽 [\d,]+개/)).toBeVisible();
    await expect(dataPanel.getByText(/매일 오전 10시, 오후 2시, 오후 6시 갱신/)).toBeVisible();
    await saveScreenshot(page, "TC-012-data-meta.png");
    await assertNoRuntimeErrors();
  });

  test("TC-013 버그 제보 링크 클릭 시 이메일 복사 결과를 toast로 알린다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.goto("/");
    await page.getByRole("link", { name: /버그 제보:/ }).click();

    await expect(page.getByRole("status")).toHaveText(/이메일이 복사되었습니다\.|복사에 실패했습니다\./);
    await saveScreenshot(page, "TC-013-bug-report-copy.png");
    await assertNoRuntimeErrors();
  });

  test("TC-014 manifest 404 시 정적 데이터 없음 notice를 표시한다", async ({ page }) => {
    const assertNoRuntimeErrors = monitorRuntime(page);

    await page.route("**/data/manifest.json", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}"
      });
    });
    await page.goto("/");

    await expect(page.getByText("수집된 데이터가 없습니다. GitHub Actions 또는 npm run data:refresh로 데이터를 생성해 주세요.")).toBeVisible();
    await saveScreenshot(page, "TC-014-missing-data.png");
    await assertNoRuntimeErrors();
  });
});
