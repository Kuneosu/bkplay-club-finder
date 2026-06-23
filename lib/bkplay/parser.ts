import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ClubDraw, MatchRow, PlayingCategory, StandingRow, TournamentStatus, TournamentSummary } from "@/lib/types";
import { toAbsoluteBkplayUrl } from "@/lib/bkplay/http";

export function normalizeText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(value: string | undefined) {
  if (!value) return null;
  const normalized = normalizeText(value).replace(/,/g, "");
  if (!/^-?\d+$/.test(normalized)) return null;
  return Number(normalized);
}

export function extractParam(url: string, name: string) {
  try {
    return new URL(toAbsoluteBkplayUrl(url)).searchParams.get(name) || undefined;
  } catch {
    return undefined;
  }
}

function normalizeStatus(text: string): TournamentStatus {
  const value = normalizeText(text);
  if (value.includes("진행중")) return "진행중";
  if (value.includes("접수중")) return "접수중";
  if (value.includes("접수예정")) return "접수예정";
  if (value.includes("접수완료")) return "접수완료";
  if (value.includes("종료")) return "종료";
  return "알수없음";
}

function extractLabel(lines: string[], label: string) {
  const line = lines.find((item) => item.startsWith(`${label} :`) || item.startsWith(`${label}:`));
  return line?.replace(new RegExp(`^${label}\\s*:\\s*`), "").trim();
}

function extractDates(value?: string) {
  if (!value) return {};
  const match = value.match(/(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})/);
  if (!match) return {};
  return { startDate: match[1], endDate: match[2] };
}

export function parseTournamentList(html: string) {
  const $ = cheerio.load(html);
  const tournaments = new Map<string, TournamentSummary>();

  $('a[href*="/tournament/detail.do?tnmtId="]').each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const id = extractParam(href, "tnmtId");
    if (!id || tournaments.has(id)) return;

    const round = extractParam(href, "tnmtRound") || extractParam(href, "tnmtRount");
    const container = $(element).closest("li");
    const title = normalizeText(container.find(".title").first().text()) || normalizeText($(element).text());
    if (!title || title.includes("${")) return;

    const textLines = container
      .text()
      .split("\n")
      .map(normalizeText)
      .filter(Boolean);
    const period = extractLabel(textLines, "기간") || extractLabel(textLines, "대회기간");
    const dates = extractDates(period);

    tournaments.set(id, {
      id,
      round,
      name: title,
      status: normalizeStatus(container.find(".status").first().text()),
      ...dates,
      host: extractLabel(textLines, "주관"),
      venue: extractLabel(textLines, "장소"),
      detailUrl: toAbsoluteBkplayUrl(href)
    });
  });

  const pageNumbers = [...html.matchAll(/fn_pageMoveTournamentList\((\d+)/g)].map((match) => Number(match[1]));

  return {
    tournaments: [...tournaments.values()],
    totalPages: pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1
  };
}

export function isDrawPublished(detailHtml: string) {
  return !/if\s*\('false'\s*===\s*'false'\)\s*\{\s*alert\('대진표 공개 전입니다\.'\)/.test(detailHtml);
}

export function parseCategories(html: string, tournamentId: string) {
  const $ = cheerio.load(html);
  const categories: PlayingCategory[] = [];

  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;

    const link = cells.eq(4).find('a[href*="/tournament/qualifierMatch"]').first();
    const href = link.attr("href");
    if (!href) return;

    const playingCategoryId = extractParam(href, "playingCategoryId");
    if (!playingCategoryId) return;

    const event = normalizeText(cells.eq(0).text());
    const age = normalizeText(cells.eq(1).text());
    const level = normalizeText(cells.eq(2).text());
    const teamCount = toNumber(cells.eq(3).text());

    categories.push({
      event,
      age,
      level,
      teamCount,
      playingCategoryId,
      title: normalizeText(`${event} ${age} ${level}`),
      sourceUrl: toAbsoluteBkplayUrl(`/tournament/qualifierMatch?tnmtId=${tournamentId}&playingCategoryId=${playingCategoryId}`)
    });
  });

  return categories;
}

function parseTeamAndPlayers(rawText: string) {
  const text = normalizeText(rawText);
  const match = text.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return { teamName: text, players: [] };

  return {
    teamName: normalizeText(match[1]),
    players: match[2]
      .split(/[\/,]/)
      .map(normalizeText)
      .filter(Boolean)
  };
}

function getDrawId(category: PlayingCategory, groupId?: string, groupName?: string) {
  return `${category.playingCategoryId}-${groupId || groupName || "group"}`;
}

function parseStandingRow($: cheerio.CheerioAPI, row: Element, clubName?: string): StandingRow | null {
  const cells = $(row).find("td");
  if (cells.length < 10) return null;

  const team = parseTeamAndPlayers($(cells[1]).text());
  if (!team.teamName) return null;
  const includesClub = clubName ? team.teamName.includes(clubName) : false;

  return {
    rank: toNumber($(cells[0]).text()),
    teamName: team.teamName,
    players: team.players,
    wins: toNumber($(cells[2]).text()),
    losses: toNumber($(cells[3]).text()),
    game: {
      scored: toNumber($(cells[4]).text()),
      conceded: toNumber($(cells[5]).text()),
      diff: toNumber($(cells[6]).text())
    },
    point: {
      scored: toNumber($(cells[7]).text()),
      conceded: toNumber($(cells[8]).text()),
      diff: toNumber($(cells[9]).text())
    },
    includesClub,
    isCombinedClub: includesClub && /[&＆]/.test(team.teamName)
  };
}

function parseTimeFromContainerId(id?: string) {
  const match = id?.match(/matchTimeDiv(\d{2})(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function parseSide($: cheerio.CheerioAPI, side: cheerio.Cheerio<Element>) {
  const teamName = normalizeText(side.children("p").not(".name").first().text());
  const players = normalizeText(side.children("p.name").first().text());
  if (!teamName) return "";
  return players ? `${teamName} (${players})` : teamName;
}

function parseDateInfo(rawText: string) {
  const text = normalizeText(rawText);
  const match = text.match(/(?:(\d{4}\.\d{2}\.\d{2}\([^)]+\))\s*)?(\d{2}:\d{2})\s+(\d+코트)\s+(\d+번)/);
  if (!match) return {};

  return {
    date: match[1],
    time: match[2],
    court: match[3],
    matchNo: match[4]
  };
}

function parseMatchRow($: cheerio.CheerioAPI, box: Element, clubName?: string): MatchRow | null {
  const element = $(box);
  const text = normalizeText(element.text());
  if (!text || (clubName && !text.includes(clubName))) return null;

  const sideTeams = [parseSide($, element.find(".left").first()), parseSide($, element.find(".right").first())].filter(Boolean);
  const fallbackTeams = element
    .find(".team")
    .map((_, team) => normalizeText($(team).text()))
    .get()
    .filter(Boolean);
  const teams = sideTeams.length > 0 ? sideTeams : fallbackTeams;

  const score = normalizeText(element.find(".score").first().text());
  const timeContainer = element.closest('[id^="matchTimeDiv"]');
  const dateInfo = parseDateInfo(element.find(".date").first().text());

  return {
    date: dateInfo.date,
    time: dateInfo.time || parseTimeFromContainerId(timeContainer.attr("id")),
    court: dateInfo.court,
    matchNo: dateInfo.matchNo,
    title: normalizeText(element.find(".title").first().text()),
    status: normalizeText(element.find(".flag").first().text()) || undefined,
    firstTeam: teams[0],
    secondTeam: teams[1],
    score: score || undefined,
    text,
    includesClub: clubName ? text.includes(clubName) : false
  };
}

export function parseQualifierGroupUrls(html: string) {
  const $ = cheerio.load(html);
  const urls = $("ul.tab-sub6 a")
    .map((_, link) => {
      const href = $(link).attr("href");
      return href && href.includes("/tournament/qualifierMatch") ? toAbsoluteBkplayUrl(href) : "";
    })
    .get()
    .filter(Boolean);

  return [...new Set(urls)];
}

export function markDrawForClub(draw: ClubDraw, clubName: string): ClubDraw | null {
  if (!clubName) return null;

  const standings = draw.standings.map((standing) => {
    const includesClub = standing.teamName.includes(clubName);
    return {
      ...standing,
      includesClub,
      isCombinedClub: includesClub && /[&＆]/.test(standing.teamName)
    };
  });

  const matches = draw.matches
    .map((match) => {
      const includesClub =
        Boolean(match.firstTeam?.includes(clubName)) ||
        Boolean(match.secondTeam?.includes(clubName)) ||
        match.text.includes(clubName);

      return {
        ...match,
        includesClub
      };
    })
    .filter((match) => match.includesClub);

  if (!standings.some((standing) => standing.includesClub) && matches.length === 0) return null;

  return {
    ...draw,
    standings,
    matches
  };
}

export function parseQualifierDraw(params: {
  html: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  tournamentStartDate?: string;
  tournamentEndDate?: string;
  tournamentVenue?: string;
  category: PlayingCategory;
}): ClubDraw | null {
  const $ = cheerio.load(params.html);
  const detailSpans = $(".match-info .detail")
    .first()
    .find("span")
    .map((_, span) => normalizeText($(span).text()))
    .get()
    .filter(Boolean);
  const groupLink = $("ul.tab-sub6 li.active a").first();
  const groupHref = groupLink.attr("href") || "";
  const groupName = normalizeText(groupLink.text()) || undefined;
  const groupId = extractParam(groupHref, "groupId") || extractParam(params.category.sourceUrl, "groupId");

  const standings: StandingRow[] = [];
  $("table.table").each((_, table) => {
    const headerText = normalizeText($(table).find("thead").text());
    if (!headerText.includes("순위") || !headerText.includes("팀명")) return;

    $(table)
      .find("tbody tr")
      .each((__, row) => {
        const parsed = parseStandingRow($, row);
        if (parsed) standings.push(parsed);
      });
  });

  const matches = $("#matchList .match-box")
    .map((_, box) => parseMatchRow($, box))
    .get()
    .filter((item): item is MatchRow => Boolean(item));

  if (standings.length === 0 && matches.length === 0) return null;

  return {
    drawId: getDrawId(params.category, groupId, groupName),
    tournamentId: params.tournamentId,
    tournamentName: params.tournamentName,
    tournamentStatus: params.tournamentStatus,
    tournamentStartDate: params.tournamentStartDate,
    tournamentEndDate: params.tournamentEndDate,
    tournamentVenue: params.tournamentVenue,
    category: params.category,
    groupName,
    groupId,
    matchDate: detailSpans[1],
    venue: detailSpans[2],
    standings,
    matches,
    sourceUrl: params.category.sourceUrl
  };
}

export function parseQualifierMatch(params: {
  html: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  tournamentStartDate?: string;
  tournamentEndDate?: string;
  tournamentVenue?: string;
  category: PlayingCategory;
  clubName: string;
}): ClubDraw | null {
  if (!params.html.includes(params.clubName)) return null;

  const draw = parseQualifierDraw({
    html: params.html,
    tournamentId: params.tournamentId,
    tournamentName: params.tournamentName,
    tournamentStatus: params.tournamentStatus,
    tournamentStartDate: params.tournamentStartDate,
    tournamentEndDate: params.tournamentEndDate,
    tournamentVenue: params.tournamentVenue,
    category: params.category
  });

  return draw ? markDrawForClub(draw, params.clubName) : null;
}
