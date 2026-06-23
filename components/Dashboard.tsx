"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ClubDraw,
  ClubIndex,
  CrawlSnapshot,
  MatchRow,
  StandingRow,
  StaticDataManifest,
  TournamentData,
  TournamentResult
} from "@/lib/types";
import { addDays, formatBkplayDate, toKoreanBasisDateTime, toKoreanDate } from "@/lib/date";
import { BKPLAY_PROVINCES, formatProvinceScope, getProvinceByOrgId } from "@/lib/regions";
import { buildSnapshotFromStaticData, filterClubIndexEntries } from "@/lib/static-search";

type Props = {
  initialClubName: string;
  initialProvinceOrgId: string;
};

type StatusFilter = "all" | "active" | "ended";
type MatchDisplay = {
  time?: string;
  court?: string;
  matchNo?: string;
  firstTeam?: string;
  secondTeam?: string;
};
type MatrixTeam = {
  label: string;
  teamName: string;
  players: string;
  key: string;
  includesClub: boolean;
};
type MatrixCell = {
  score?: string;
  status?: string;
  includesClub: boolean;
};
type ClubParticipant = {
  key: string;
  category: string;
  teamName: string;
  players: string[];
  clubPlayerIndexes: number[];
};

const DATA_MISSING_MESSAGE = "수집된 데이터가 없습니다. GitHub Actions 또는 npm run data:refresh로 데이터를 생성해 주세요.";
const DATA_SOURCE_TEXT = "BKPLAY 지역별 대회정보";
const DEFAULT_REFRESH_TIMES_KST = ["10:00", "14:00", "18:00"];

async function fetchStaticJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store"
  });

  if (response.status === 404) {
    throw new Error(DATA_MISSING_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(`정적 데이터 요청 실패: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function loadManifest() {
  return fetchStaticJson<StaticDataManifest>("/data/manifest.json");
}

async function searchStaticData(clubName: string, provinceOrgId: string) {
  const [manifest, index] = await Promise.all([
    fetchStaticJson<StaticDataManifest>("/data/manifest.json"),
    fetchStaticJson<ClubIndex>("/data/club-index.json")
  ]);
  const entries = filterClubIndexEntries(index, clubName, provinceOrgId);
  const detailPaths = [...new Set(entries.map((entry) => entry.detailPath))];
  const tournaments = await Promise.all(detailPaths.map((path) => fetchStaticJson<TournamentData>(path)));

  return buildSnapshotFromStaticData({
    generatedAt: manifest.generatedAt,
    clubName,
    provinceOrgId,
    index,
    tournaments,
    lookbackDays: manifest.scope.lookbackDays,
    lookaheadDays: manifest.scope.lookaheadDays,
    errors: manifest.errors
  });
}

function formatNumber(value?: number) {
  return typeof value === "number" ? new Intl.NumberFormat("ko-KR").format(value) : "-";
}

function getCollectionRangeText(manifest: StaticDataManifest | null) {
  if (!manifest) return "-";

  if (manifest.scope.searchStartDate && manifest.scope.searchEndDate) {
    return `${formatBkplayDate(manifest.scope.searchStartDate)} ~ ${formatBkplayDate(manifest.scope.searchEndDate)}`;
  }

  if (!manifest.generatedAt) return "-";
  const generatedAt = new Date(manifest.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    return `과거 ${manifest.scope.lookbackDays}일 ~ 미래 ${manifest.scope.lookaheadDays}일`;
  }

  return `${toKoreanDate(addDays(generatedAt, -manifest.scope.lookbackDays))} ~ ${toKoreanDate(
    addDays(generatedAt, manifest.scope.lookaheadDays)
  )}`;
}

function getCollectionBasisText(manifest: StaticDataManifest | null) {
  const lookbackDays = manifest?.scope.lookbackDays ?? 30;
  const lookaheadDays = manifest?.scope.lookaheadDays ?? 30;

  return `수집일 기준 과거 ${lookbackDays}일 ~ 미래 ${lookaheadDays}일 대회`;
}

function formatKoreanRefreshTime(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return value;
  }

  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 || 12;
  const minuteSuffix = Number.isFinite(minute) && minute > 0 ? ` ${minute}분` : "";

  return `${period} ${hour12}시${minuteSuffix}`;
}

function getRefreshTimes(manifest: StaticDataManifest | null) {
  return manifest?.scope.refreshTimesKst?.length ? manifest.scope.refreshTimesKst : DEFAULT_REFRESH_TIMES_KST;
}

function getRefreshScheduleText(manifest: StaticDataManifest | null) {
  return `매일 ${getRefreshTimes(manifest).map(formatKoreanRefreshTime).join(", ")} 갱신`;
}

function getRefreshSummaryText(manifest: StaticDataManifest | null) {
  return `BKPLAY 기준 · 매일 ${getRefreshTimes(manifest).length}회 갱신`;
}

function isActiveTournament(tournament: TournamentResult) {
  return tournament.status !== "종료";
}

function filterTournaments(tournaments: TournamentResult[], statusFilter: StatusFilter) {
  return tournaments.filter((tournament) => {
    if (statusFilter === "active" && !isActiveTournament(tournament)) return false;
    if (statusFilter === "ended" && tournament.status !== "종료") return false;
    return true;
  });
}

function EmptyState({ hasSnapshot }: { hasSnapshot: boolean }) {
  return (
    <div className="empty-state">
      <strong>{hasSnapshot ? "조건에 맞는 대진이 없습니다." : "클럽명을 입력하고 조회해 주세요."}</strong>
      <p>
        미리 수집된 대진 데이터에서 입력한 클럽명이 포함된 대진만 찾아 표시합니다.
      </p>
    </div>
  );
}

function normalizeClubCompareValue(value?: string | null) {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function getClubPlayerIndexes(teamName: string | undefined, players: string[], clubName: string) {
  if (players.length === 0) return [];

  const clubKey = normalizeClubCompareValue(clubName);
  if (!clubKey) return [];

  const teamKey = normalizeClubCompareValue(teamName);
  const teamClubs = (teamName ?? "")
    .split(/[&＆]/)
    .map((club) => club.trim())
    .filter(Boolean);

  if (teamClubs.length <= 1) {
    return teamKey.includes(clubKey) ? players.map((_, index) => index) : [];
  }

  const matchedClubIndexes = teamClubs
    .map((club, index) => ({
      index,
      isMatch: normalizeClubCompareValue(club).includes(clubKey)
    }))
    .filter((club) => club.isMatch)
    .map((club) => club.index);

  if (matchedClubIndexes.length === 0) {
    return teamKey.includes(clubKey) ? players.map((_, index) => index) : [];
  }

  if (teamClubs.length === players.length) {
    return matchedClubIndexes.filter((index) => index < players.length);
  }

  return teamKey.includes(clubKey) ? players.map((_, index) => index) : [];
}

function createClubParticipant(draw: ClubDraw, standing: StandingRow, clubName: string): ClubParticipant {
  const players = standing.players.filter(Boolean);
  const key = `${draw.category.title}:${standing.teamName}:${players.join("/")}`;

  return {
    key,
    category: draw.category.title,
    teamName: standing.teamName,
    players,
    clubPlayerIndexes: getClubPlayerIndexes(standing.teamName, players, clubName)
  };
}

function getClubParticipants(tournament: TournamentResult, clubName: string): ClubParticipant[] {
  const participantMap = new Map<string, ClubParticipant>();

  tournament.draws.forEach((draw) => {
    draw.standings
      .filter((standing) => standing.includesClub)
      .forEach((standing) => {
        const participant = createClubParticipant(draw, standing, clubName);
        participantMap.set(participant.key, participant);
      });
  });

  return [...participantMap.values()];
}

function getDrawClubParticipants(draw: ClubDraw, clubName: string): ClubParticipant[] {
  return draw.standings
    .filter((standing) => standing.includesClub)
    .map((standing) => createClubParticipant(draw, standing, clubName));
}

function getDrawKey(draw: ClubDraw) {
  return draw.drawId || `${draw.category.playingCategoryId}-${draw.groupId || draw.groupName || "group"}`;
}

function getParticipantName(participant: ClubParticipant) {
  return participant.players.length > 0 ? participant.players.join(" / ") : participant.teamName;
}

function ParticipantPlayerNames({ participant }: { participant: ClubParticipant }) {
  if (participant.players.length === 0) {
    return <strong>{participant.teamName}</strong>;
  }

  return (
    <strong>
      {participant.players.map((player, index) => (
        <span key={`${participant.key}-${player}-${index}`} className="player-name-token">
          <span className={participant.clubPlayerIndexes.includes(index) ? "club-player-highlight" : ""}>{player}</span>
          {index < participant.players.length - 1 ? <span className="player-separator"> / </span> : null}
        </span>
      ))}
    </strong>
  );
}

function TournamentListCard({
  tournament,
  clubName,
  onSelect
}: {
  tournament: TournamentResult;
  clubName: string;
  onSelect: () => void;
}) {
  const participants = getClubParticipants(tournament, clubName);
  const visibleParticipants = participants.slice(0, 4);
  const hiddenCount = Math.max(0, participants.length - visibleParticipants.length);

  return (
    <button type="button" className="tournament-list-card" onClick={onSelect}>
      <div className="list-card-head">
        <span className={`status status-${tournament.status}`}>{tournament.status}</span>
        <strong>{tournament.name}</strong>
      </div>

      <div className="list-card-meta">
        <span>기간</span>
        <p>
          {tournament.startDate || "-"} ~ {tournament.endDate || "-"}
        </p>
        <span>장소</span>
        <p>{tournament.venue || "-"}</p>
      </div>

      <div className="participant-block">
        <span>출전자 {participants.length}팀</span>
        <div className="participant-inline-list">
          {visibleParticipants.length > 0 ? (
            visibleParticipants.map((participant) => (
              <span key={participant.key} className="participant-inline-item">
                <ParticipantPlayerNames participant={participant} />
                <small>{participant.category}</small>
              </span>
            ))
          ) : (
            <span className="participant-inline-item">
              <strong>{clubName} 포함 팀</strong>
            </span>
          )}
          {hiddenCount > 0 ? (
            <span className="participant-inline-more">외 {hiddenCount}팀</span>
          ) : null}
        </div>
      </div>

      <div className="list-card-footer">
        <span>{tournament.draws.length}개 대진</span>
        <b>상세 보기</b>
      </div>
    </button>
  );
}

function DetailParticipantSummary({ tournament, clubName }: { tournament: TournamentResult; clubName: string }) {
  const participants = getClubParticipants(tournament, clubName);

  return (
    <section className="detail-participants">
      <div className="detail-section-head">
        <h3>{clubName} 출전자</h3>
        <span>{participants.length}팀</span>
      </div>
      <div className="participant-table-wrap">
        <table className="participant-table">
          <thead>
            <tr>
              <th>대진</th>
              <th>참가자</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.key}>
                <td>
                  <strong>{participant.category}</strong>
                </td>
                <td className="participant-name-cell">
                  <ParticipantPlayerNames participant={participant} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function includesClub(team: string | undefined, clubName: string) {
  return Boolean(team && team.includes(clubName));
}

function normalizeTeamKey(value: string) {
  return value
    .normalize("NFKC")
    .replace(/＆/g, "&")
    .replace(/[()\s,·\/]/g, "")
    .trim();
}

function getTeamLabel(standing: StandingRow) {
  if (standing.players.length === 0) return standing.teamName;
  return `${standing.teamName} (${standing.players.join(" / ")})`;
}

function buildMatrixTeams(draw: ClubDraw): MatrixTeam[] {
  return draw.standings.map((standing) => {
    const label = getTeamLabel(standing);
    const players = standing.players.join(" / ");

    return {
      label,
      teamName: standing.teamName,
      players,
      key: normalizeTeamKey(label),
      includesClub: standing.includesClub
    };
  });
}

function parseMatchTextFallback(match: MatchRow): MatchDisplay {
  const display: MatchDisplay = {};
  let body = match.text;
  const schedule = body.match(/(?:(\d{4}\.\d{2}\.\d{2}\([^)]+\))\s*)?(\d{2}:\d{2})\s+(\d+코트)\s+(\d+번)\s*$/);

  if (schedule) {
    display.time = schedule[2];
    display.court = schedule[3];
    display.matchNo = schedule[4];
    body = body.slice(0, schedule.index).trim();
  }

  if (match.status && body.startsWith(match.status)) {
    body = body.slice(match.status.length).trim();
  }

  if (match.title && body.startsWith(match.title)) {
    body = body.slice(match.title.length).trim();
  }

  if (match.score) {
    const scoreIndex = body.indexOf(match.score);
    if (scoreIndex >= 0) {
      display.firstTeam = body.slice(0, scoreIndex).trim();
      display.secondTeam = body.slice(scoreIndex + match.score.length).trim();
    }
  }

  return display;
}

function findMatrixTeamIndex(teams: MatrixTeam[], teamText?: string) {
  if (!teamText) return -1;
  const key = normalizeTeamKey(teamText);
  let index = teams.findIndex((team) => team.key === key);
  if (index >= 0) return index;

  index = teams.findIndex((team) => key === normalizeTeamKey(`${team.teamName}${team.players}`));
  if (index >= 0) return index;

  return teams.findIndex((team) => {
    const teamOnlyKey = normalizeTeamKey(team.teamName);
    const sameTeamNameCount = teams.filter((candidate) => normalizeTeamKey(candidate.teamName) === teamOnlyKey).length;
    return key === teamOnlyKey && sameTeamNameCount === 1;
  });
}

function getMatchDisplay(match: MatchRow): MatchDisplay {
  const fallback = parseMatchTextFallback(match);

  return {
    time: match.time || fallback.time,
    court: match.court || fallback.court,
    matchNo: match.matchNo || fallback.matchNo,
    firstTeam: match.firstTeam || fallback.firstTeam,
    secondTeam: match.secondTeam || fallback.secondTeam
  };
}

function buildMatrixCells(draw: ClubDraw, teams: MatrixTeam[], clubName: string) {
  const cells = new Map<string, MatrixCell>();

  draw.matches.forEach((match) => {
    const display = getMatchDisplay(match);
    const firstIndex = findMatrixTeamIndex(teams, display.firstTeam);
    const secondIndex = findMatrixTeamIndex(teams, display.secondTeam);
    if (firstIndex < 0 || secondIndex < 0) return;

    const cell = {
      score: match.score,
      status: match.status,
      includesClub:
        teams[firstIndex].includesClub ||
        teams[secondIndex].includesClub ||
        includesClub(display.firstTeam, clubName) ||
        includesClub(display.secondTeam, clubName)
    };

    cells.set(`${firstIndex}:${secondIndex}`, cell);
    cells.set(`${secondIndex}:${firstIndex}`, cell);
  });

  return cells;
}

function DrawMatrix({ draw, clubName }: { draw: ClubDraw; clubName: string }) {
  const teams = buildMatrixTeams(draw);
  const cells = buildMatrixCells(draw, teams, clubName);

  if (teams.length === 0) return null;

  return (
    <div className="draw-matrix-wrap">
      <div className="draw-matrix-head">
        <h4>대진표</h4>
        <span>{teams.length}팀</span>
      </div>
      <div className="draw-matrix-scroll">
        <table className="draw-matrix">
          <thead>
            <tr>
              <th>팀명</th>
              {teams.map((team) => (
                <th key={team.key} className={team.includesClub ? "matrix-club" : ""}>
                  <span>{team.teamName}</span>
                  {team.players ? <small>{team.players}</small> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((rowTeam, rowIndex) => (
              <tr key={rowTeam.key}>
                <th className={rowTeam.includesClub ? "matrix-club" : ""}>
                  <span>{rowTeam.teamName}</span>
                  {rowTeam.players ? <small>{rowTeam.players}</small> : null}
                </th>
                {teams.map((columnTeam, columnIndex) => {
                  const cell = cells.get(`${rowIndex}:${columnIndex}`);
                  const isSelf = rowIndex === columnIndex;

                  return (
                    <td key={`${rowTeam.key}-${columnTeam.key}`} className={cell?.includesClub ? "matrix-match-club" : ""}>
                      {isSelf ? (
                        <span className="matrix-self">-</span>
                      ) : cell ? (
                        <>
                          <strong>{cell.score || "예정"}</strong>
                          {cell.status ? <small>{cell.status}</small> : null}
                        </>
                      ) : (
                        <span className="matrix-empty">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchItem({ match, clubName }: { match: MatchRow; clubName: string }) {
  const display = getMatchDisplay(match);
  const subText = [match.status, match.score ? `스코어 ${match.score}` : null, display.matchNo].filter(Boolean).join(" · ");

  return (
    <div className="match-item">
      <div className="match-timebox">
        <strong>{display.time || "시간 미정"}</strong>
        <span>{display.court || "코트 미정"}</span>
      </div>
      <div className="match-detail">
        <div className="match-teams">
          {display.firstTeam && display.secondTeam ? (
            <>
              <span className={`match-team-name ${includesClub(display.firstTeam, clubName) ? "club-team" : ""}`}>
                {display.firstTeam}
              </span>
              <b>vs</b>
              <span className={`match-team-name ${includesClub(display.secondTeam, clubName) ? "club-team" : ""}`}>
                {display.secondTeam}
              </span>
            </>
          ) : (
            <span className="match-fallback">{match.text}</span>
          )}
        </div>
        {subText ? <p>{subText}</p> : null}
      </div>
    </div>
  );
}

function DrawPanel({
  draw,
  clubName,
  expanded,
  onToggle
}: {
  draw: ClubDraw;
  clubName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const participants = getDrawClubParticipants(draw, clubName);

  return (
    <article className={`draw-panel ${expanded ? "draw-panel-expanded" : ""}`}>
      <div className="draw-head">
        <button type="button" className="draw-toggle" onClick={onToggle} aria-expanded={expanded}>
          <div>
            <h3>{draw.category.title}</h3>
            <p>
              {draw.groupName || "조 정보 없음"} · {draw.matchDate || "일정 미정"} · {draw.venue || "경기장 미정"}
            </p>
          </div>
          <div className="draw-summary">
            <span>{draw.matches.length}경기</span>
            <span>{clubName} {participants.length}팀</span>
            <b>{expanded ? "접기" : "펼치기"}</b>
          </div>
        </button>
        <a href={draw.sourceUrl} target="_blank" rel="noreferrer">
          원본
        </a>
      </div>

      {expanded ? (
        <div className="draw-body">
          <DrawMatrix draw={draw} clubName={clubName} />

          {draw.matches.length > 0 ? (
            <div className="match-list">
              <h4>경기 일정</h4>
              {draw.matches.map((match, index) => (
                <MatchItem key={`${match.time}-${match.court}-${index}`} match={match} clubName={clubName} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function DrawCard({ tournament, clubName }: { tournament: TournamentResult; clubName: string }) {
  const [expandedDrawIds, setExpandedDrawIds] = useState<Set<string>>(() => new Set());

  function toggleDraw(drawKey: string) {
    setExpandedDrawIds((current) => {
      const next = new Set(current);
      if (next.has(drawKey)) {
        next.delete(drawKey);
      } else {
        next.add(drawKey);
      }
      return next;
    });
  }

  return (
    <section className="tournament-card">
      <div className="card-head">
        <div>
          <span className={`status status-${tournament.status}`}>{tournament.status}</span>
          <h2>{tournament.name}</h2>
        </div>
        <a href={tournament.detailUrl} target="_blank" rel="noreferrer">
          원본 보기
        </a>
      </div>

      <div className="meta-grid">
        <span>기간</span>
        <strong>
          {tournament.startDate || "-"} ~ {tournament.endDate || "-"}
        </strong>
        <span>장소</span>
        <strong>{tournament.venue || "-"}</strong>
      </div>

      <DetailParticipantSummary tournament={tournament} clubName={clubName} />

      <div className="draw-list">
        {tournament.draws.map((draw) => {
          const drawKey = getDrawKey(draw);
          return (
            <DrawPanel
              key={drawKey}
              draw={draw}
              clubName={clubName}
              expanded={expandedDrawIds.has(drawKey)}
              onToggle={() => toggleDraw(drawKey)}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ initialClubName, initialProvinceOrgId }: Props) {
  const [clubInput, setClubInput] = useState(initialClubName);
  const [provinceOrgId, setProvinceOrgId] = useState(initialProvinceOrgId);
  const [manifest, setManifest] = useState<StaticDataManifest | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<CrawlSnapshot | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const clubName = latestSnapshot?.scope.clubName || clubInput.trim() || initialClubName;
  const selectedProvince = getProvinceByOrgId(provinceOrgId) || getProvinceByOrgId(initialProvinceOrgId);

  useEffect(() => {
    let mounted = true;

    loadManifest()
      .then((loadedManifest) => {
        if (!mounted) return;
        setManifest(loadedManifest);
        setLoadMessage(null);
      })
      .catch((error) => {
        if (!mounted) return;
        setLoadMessage(error instanceof Error ? error.message : DATA_MISSING_MESSAGE);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextClubName = clubInput.trim();
    if (!nextClubName) {
      setLoadMessage("클럽명을 입력해 주세요.");
      return;
    }

    setIsSearching(true);
    setLoadMessage(null);
    setSelectedTournamentId(null);

    try {
      const snapshot = await searchStaticData(nextClubName, provinceOrgId);
      setLatestSnapshot(snapshot);
    } catch (error) {
      setLoadMessage(error instanceof Error ? error.message : "조회에 실패했습니다.");
    } finally {
      setIsSearching(false);
    }
  }

  const filtered = useMemo(
    () => filterTournaments(latestSnapshot?.tournaments ?? [], statusFilter),
    [statusFilter, latestSnapshot?.tournaments]
  );
  const selectedTournament = filtered.find((tournament) => tournament.id === selectedTournamentId) || null;

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">BKPLAY 지역 대회</p>
          <h1>클럽 대진표 조회</h1>
        </div>
        <div className="refresh-box">
          <span>데이터 기준</span>
          <strong>{toKoreanBasisDateTime(manifest?.generatedAt || latestSnapshot?.refreshedAt)}</strong>
        </div>
      </header>

      <section className="search-panel">
        <form onSubmit={handleSearch}>
          <label htmlFor="provinceOrgId">지역</label>
          <select
            id="provinceOrgId"
            value={provinceOrgId}
            onChange={(event) => setProvinceOrgId(event.target.value)}
            disabled={isSearching}
          >
            {BKPLAY_PROVINCES.map((province) => (
              <option key={province.orgId || "all"} value={province.orgId}>
                {province.name}
              </option>
            ))}
          </select>
          <label htmlFor="clubName">클럽명</label>
          <input
            id="clubName"
            value={clubInput}
            onChange={(event) => setClubInput(event.target.value)}
            placeholder="예: 마코클럽"
            disabled={isSearching}
          />
          <button type="submit" disabled={isSearching}>
            {isSearching ? "조회 중" : "조회"}
          </button>
        </form>
        <p>미리 준비된 대회 데이터에서 입력한 클럽명이 포함된 대진을 빠르게 조회합니다.</p>
      </section>

      <details className="data-meta-disclosure">
        <summary>
          <span>데이터 안내</span>
          <strong>{getRefreshSummaryText(manifest)}</strong>
        </summary>
        <div className="data-meta-panel" aria-label="수집 데이터 정보">
          <div>
            <span>데이터 출처</span>
            <strong>{DATA_SOURCE_TEXT}</strong>
          </div>
          <div>
            <span>수집 기준</span>
            <strong>{getCollectionBasisText(manifest)}</strong>
          </div>
          <div>
            <span>수집 기간</span>
            <strong>{getCollectionRangeText(manifest)}</strong>
          </div>
          <div>
            <span>갱신 시간</span>
            <strong>{getRefreshScheduleText(manifest)}</strong>
          </div>
          <div>
            <span>전체 수집 데이터</span>
            <strong>
              대회 {formatNumber(manifest?.stats.tournamentCount)}개 · 대진 {formatNumber(manifest?.stats.drawCount)}개 · 클럽{" "}
              {formatNumber(manifest?.stats.clubCount)}개
            </strong>
          </div>
        </div>
      </details>

      <section className="summary-band">
        <div>
          <span>조회 클럽</span>
          <strong>{latestSnapshot?.scope.clubName || "-"}</strong>
        </div>
        <div>
          <span>발견 대회</span>
          <strong>{latestSnapshot?.stats.matchedTournaments ?? 0}</strong>
        </div>
        <div>
          <span>대진</span>
          <strong>{latestSnapshot?.stats.matchedDraws ?? 0}</strong>
        </div>
        <div>
          <span>수집 범위</span>
          <strong>
            {latestSnapshot
              ? formatProvinceScope(latestSnapshot.scope.provinceName)
              : formatProvinceScope(selectedProvince?.name || "부산")}
          </strong>
        </div>
      </section>

      {loadMessage ? <div className="notice">{loadMessage}</div> : null}

      {latestSnapshot?.errors.length ? <div className="notice">일부 수집 경고 {latestSnapshot.errors.length}건이 있습니다.</div> : null}

      <section className="toolbar" aria-label="대회 상태 필터">
        <div className="segmented">
          <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>
            전체
          </button>
          <button className={statusFilter === "active" ? "active" : ""} onClick={() => setStatusFilter("active")}>
            예정·진행
          </button>
          <button className={statusFilter === "ended" ? "active" : ""} onClick={() => setStatusFilter("ended")}>
            종료
          </button>
        </div>
      </section>

      <section className="content-list">
        {selectedTournament ? (
          <div className="detail-view">
            <button type="button" className="back-button" onClick={() => setSelectedTournamentId(null)}>
              대회 목록
            </button>
            <DrawCard tournament={selectedTournament} clubName={clubName} />
          </div>
        ) : filtered.length > 0 ? (
          <div className="tournament-list">
            {filtered.map((tournament) => (
              <TournamentListCard
                key={tournament.id}
                tournament={tournament}
                clubName={clubName}
                onSelect={() => setSelectedTournamentId(tournament.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState hasSnapshot={Boolean(latestSnapshot)} />
        )}
      </section>
    </main>
  );
}
