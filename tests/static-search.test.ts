import { describe, expect, it } from "vitest";
import { buildClubIndex } from "@/lib/bkplay/prebuild";
import { buildSnapshotFromStaticData, filterClubIndexEntries, normalizeClubSearchKey } from "@/lib/static-search";
import type { TournamentData } from "@/lib/types";

const tournament: TournamentData = {
  id: "3879",
  name: "제2회 수영구배드민턴협회 여성부 대회",
  status: "종료",
  startDate: "2026.06.21",
  endDate: "2026.06.21",
  venue: "수영구민센터-민락",
  detailUrl: "https://sfa.bkplay.kr/tournament/detail.do?tnmtId=3879",
  provinceOrgId: "3",
  provinceName: "부산",
  draws: [
    {
      drawId: "99262-123407",
      tournamentId: "3879",
      tournamentName: "제2회 수영구배드민턴협회 여성부 대회",
      tournamentStatus: "종료",
      tournamentStartDate: "2026.06.21",
      tournamentEndDate: "2026.06.21",
      tournamentVenue: "수영구민센터-민락",
      category: {
        event: "여복",
        age: "10,20대,30대",
        level: "D",
        teamCount: 6,
        playingCategoryId: "99262",
        title: "여복 10,20대,30대 D",
        sourceUrl: "https://sfa.bkplay.kr/tournament/qualifierMatch?tnmtId=3879&playingCategoryId=99262&groupId=123407"
      },
      groupName: "1조",
      groupId: "123407",
      matchDate: "06월21일(일)",
      venue: "수영구민센터-민락",
      standings: [
        {
          rank: 1,
          teamName: "수영구스포츠클럽&마코클럽",
          players: ["윤정", "박유정"],
          wins: 5,
          losses: 0,
          game: { scored: 5, conceded: 0, diff: 5 },
          point: { scored: 105, conceded: 50, diff: 55 },
          includesClub: false,
          isCombinedClub: false
        },
        {
          rank: 6,
          teamName: "마코클럽",
          players: ["노은아", "이혜미"],
          wins: 0,
          losses: 5,
          game: { scored: 0, conceded: 5, diff: -5 },
          point: { scored: 55, conceded: 105, diff: -50 },
          includesClub: false,
          isCombinedClub: false
        }
      ],
      matches: [
        {
          date: "2026.06.21(Sun)",
          time: "09:30",
          court: "4코트",
          matchNo: "7번",
          title: "1코트",
          status: "종료",
          firstTeam: "수영구스포츠클럽&마코클럽 ( 윤정 / 박유정 )",
          secondTeam: "마코클럽 ( 노은아 / 이혜미 )",
          score: "21 : 5",
          text: "수영구스포츠클럽&마코클럽 21 : 5 마코클럽",
          includesClub: false
        }
      ],
      sourceUrl: "https://sfa.bkplay.kr/tournament/qualifierMatch?tnmtId=3879&playingCategoryId=99262&groupId=123407"
    }
  ]
};

describe("정적 데이터 검색", () => {
  it("클럽명 검색 키를 정규화한다", () => {
    expect(normalizeClubSearchKey(" 마코 클럽 ")).toBe("마코클럽");
  });

  it("클럽 인덱스를 만들고 지역별 항목을 필터링한다", () => {
    const index = buildClubIndex([tournament], "2026-06-23T00:00:00.000Z");

    expect(filterClubIndexEntries(index, "마코클럽", "3")).toHaveLength(1);
    expect(filterClubIndexEntries(index, "마코클럽", "10")).toHaveLength(0);
  });

  it("정적 대회 데이터를 화면용 스냅샷으로 변환한다", () => {
    const index = buildClubIndex([tournament], "2026-06-23T00:00:00.000Z");
    const snapshot = buildSnapshotFromStaticData({
      generatedAt: "2026-06-23T00:00:00.000Z",
      clubName: "마코클럽",
      provinceOrgId: "3",
      index,
      tournaments: [tournament],
      lookbackDays: 180,
      lookaheadDays: 180
    });

    expect(snapshot.stats.matchedTournaments).toBe(1);
    expect(snapshot.stats.matchedDraws).toBe(1);
    expect(snapshot.tournaments[0].draws[0].standings.filter((standing) => standing.includesClub)).toHaveLength(2);
    expect(snapshot.tournaments[0].draws[0].matches).toHaveLength(1);
  });
});
