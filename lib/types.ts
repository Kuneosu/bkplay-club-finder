export type TournamentStatus = "진행중" | "접수중" | "접수예정" | "접수완료" | "종료" | "알수없음";

export type TournamentSummary = {
  id: string;
  round?: string;
  name: string;
  status: TournamentStatus;
  startDate?: string;
  endDate?: string;
  host?: string;
  venue?: string;
  detailUrl: string;
};

export type PlayingCategory = {
  event: string;
  age: string;
  level: string;
  teamCount: number | null;
  playingCategoryId: string;
  title: string;
  sourceUrl: string;
};

export type StandingRow = {
  rank: number | null;
  teamName: string;
  players: string[];
  wins: number | null;
  losses: number | null;
  game: {
    scored: number | null;
    conceded: number | null;
    diff: number | null;
  };
  point: {
    scored: number | null;
    conceded: number | null;
    diff: number | null;
  };
  includesClub: boolean;
  isCombinedClub: boolean;
};

export type MatchRow = {
  date?: string;
  time?: string;
  court?: string;
  matchNo?: string;
  title: string;
  status?: string;
  firstTeam?: string;
  secondTeam?: string;
  score?: string;
  text: string;
  includesClub: boolean;
};

export type ClubDraw = {
  drawId: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  tournamentStartDate?: string;
  tournamentEndDate?: string;
  tournamentVenue?: string;
  category: PlayingCategory;
  groupName?: string;
  groupId?: string;
  matchDate?: string;
  venue?: string;
  standings: StandingRow[];
  matches: MatchRow[];
  sourceUrl: string;
};

export type TournamentResult = TournamentSummary & {
  draws: ClubDraw[];
};

export type TournamentData = TournamentSummary & {
  provinceOrgId: string;
  provinceName: string;
  draws: ClubDraw[];
};

export type CrawlStats = {
  scannedTournaments: number;
  scannedCategories: number;
  matchedTournaments: number;
  matchedDraws: number;
  skippedNotPublished: number;
};

export type SnapshotScope = {
  clubName: string;
  provinceOrgId: string;
  provinceName: string;
  lookbackDays: number;
  lookaheadDays: number;
};

export type CrawlSnapshot = {
  refreshedAt: string;
  scope: SnapshotScope;
  tournaments: TournamentResult[];
  stats: CrawlStats;
  errors: string[];
};

export type StaticDataManifest = {
  generatedAt: string;
  scope: {
    provinceOrgIds: string[];
    lookbackDays: number;
    lookaheadDays: number;
    searchStartDate?: string;
    searchEndDate?: string;
    refreshTimesKst?: string[];
    maxPages: number;
    maxTournaments: number;
    maxCategories: number;
  };
  stats: {
    tournamentCount: number;
    drawCount: number;
    clubCount: number;
    scannedTournaments: number;
    scannedCategories: number;
  };
  errors: string[];
};

export type ClubIndexEntry = {
  clubName: string;
  provinceOrgId: string;
  provinceName: string;
  tournamentId: string;
  drawIds: string[];
  detailPath: string;
};

export type ClubIndex = {
  generatedAt: string;
  clubs: Record<string, ClubIndexEntry[]>;
};

export type LastRun = {
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  message?: string;
};
