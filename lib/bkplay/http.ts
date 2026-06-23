const BKPLAY_ORIGIN = "https://sfa.bkplay.kr";

export function toAbsoluteBkplayUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, BKPLAY_ORIGIN).toString();
}

export function buildAreaListUrl(params: {
  pageNo: number;
  pageRowCnt: number;
  provinceOrgId: string;
  cityOrgId?: string;
  status?: string;
  searchStartDate: string;
  searchEndDate: string;
}) {
  const url = new URL("/tournament/area/list.do", BKPLAY_ORIGIN);
  url.searchParams.set("pageNo", String(params.pageNo));
  url.searchParams.set("pageRowCnt", String(params.pageRowCnt));
  url.searchParams.set("provinceOrgId", params.provinceOrgId);
  url.searchParams.set("cityOrgId", params.cityOrgId || "");
  url.searchParams.set("status", params.status || "");
  url.searchParams.set("searchStartDate", params.searchStartDate);
  url.searchParams.set("searchEndDate", params.searchEndDate);
  url.searchParams.set("sortType", "DESC");
  url.searchParams.set("isFirstSearch", "false");
  return url.toString();
}

export async function fetchBkplayHtml(url: string, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent": "QUICK-BK club schedule crawler (+https://sfa.bkplay.kr)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ko-KR,ko;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(`BKPLAY 요청 실패: ${response.status} ${response.statusText} (${url})`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
