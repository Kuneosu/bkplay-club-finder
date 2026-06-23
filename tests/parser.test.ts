import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDrawPublished, parseCategories, parseQualifierMatch } from "@/lib/bkplay/parser";
import type { PlayingCategory } from "@/lib/types";

const fixture = readFileSync(join(process.cwd(), "tests/fixtures/qualifier-3879-99262.html"), "utf8");

const category: PlayingCategory = {
  event: "여복",
  age: "10,20대,30대",
  level: "D",
  teamCount: 6,
  playingCategoryId: "99262",
  title: "여복 10,20대,30대 D",
  sourceUrl: "https://sfa.bkplay.kr/tournament/qualifierMatch?tnmtId=3879&playingCategoryId=99262"
};

function parseFixture(html = fixture) {
  return parseQualifierMatch({
    html,
    tournamentId: "3879",
    tournamentName: "제2회 수영구배드민턴협회 여성부 대회",
    tournamentStatus: "종료",
    tournamentStartDate: "2026.06.21",
    tournamentEndDate: "2026.06.21",
    tournamentVenue: "수영구민센터-민락",
    category,
    clubName: "마코클럽"
  });
}

describe("BKPLAY 대진 파서", () => {
  it("3879/99262 샘플에서 마코클럽 포함 대진과 순위표를 추출한다", () => {
    const draw = parseFixture();

    expect(draw).not.toBeNull();
    expect(draw?.category.title).toBe("여복 10,20대,30대 D");
    expect(draw?.groupName).toBe("1조");
    expect(draw?.groupId).toBe("123407");
    expect(draw?.matchDate).toBe("06월21일(일)");
    expect(draw?.venue).toBe("수영구민센터-민락");
    expect(draw?.standings).toHaveLength(6);

    const combined = draw?.standings.find((row) => row.teamName === "수영구스포츠클럽&마코클럽");
    expect(combined?.players).toEqual(["윤정", "박유정"]);
    expect(combined?.rank).toBe(1);
    expect(combined?.includesClub).toBe(true);
    expect(combined?.isCombinedClub).toBe(true);

    const mako = draw?.standings.find((row) => row.teamName === "마코클럽");
    expect(mako?.players).toEqual(["노은아", "이혜미"]);
    expect(mako?.rank).toBe(6);
    expect(mako?.wins).toBe(0);
    expect(mako?.losses).toBe(5);
    expect(mako?.point.diff).toBe(-50);
    expect(mako?.isCombinedClub).toBe(false);

    expect(draw?.matches).toHaveLength(1);
    expect(draw?.matches[0]).toMatchObject({
      date: "2026.06.21(Sun)",
      time: "09:30",
      court: "4코트",
      matchNo: "7번",
      title: "1코트",
      status: "종료",
      firstTeam: "수영구스포츠클럽&마코클럽 ( 윤정 / 박유정 )",
      secondTeam: "마코클럽 ( 노은아 / 이혜미 )",
      score: "21 : 5"
    });
  });

  it("마코클럽이 없는 대진 HTML은 결과에서 제외한다", () => {
    const html = fixture.replaceAll("마코클럽", "남천클럽");

    expect(parseFixture(html)).toBeNull();
  });

  it("대진 공개 전 HTML은 공개 전 상태로 판단하고 종목도 수집하지 않는다", () => {
    const html = "<script>if ('false' === 'false') { alert('대진표 공개 전입니다.'); }</script>";

    expect(isDrawPublished(html)).toBe(false);
    expect(parseCategories(html, "3879")).toEqual([]);
  });
});
