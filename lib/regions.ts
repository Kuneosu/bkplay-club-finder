export type BkplayProvince = {
  orgId: string;
  name: string;
  abbr: string;
};

export const BKPLAY_PROVINCES: BkplayProvince[] = [
  { orgId: "", name: "전체 지역", abbr: "전체" },
  { orgId: "2", name: "서울", abbr: "서울" },
  { orgId: "3", name: "부산", abbr: "부산" },
  { orgId: "4", name: "대구", abbr: "대구" },
  { orgId: "5", name: "인천", abbr: "인천" },
  { orgId: "6", name: "광주", abbr: "광주" },
  { orgId: "7", name: "대전", abbr: "대전" },
  { orgId: "8", name: "울산", abbr: "울산" },
  { orgId: "9", name: "세종", abbr: "세종" },
  { orgId: "10", name: "경기", abbr: "경기" },
  { orgId: "11", name: "강원", abbr: "강원" },
  { orgId: "12", name: "충북", abbr: "충북" },
  { orgId: "13", name: "충남", abbr: "충남" },
  { orgId: "14", name: "전북", abbr: "전북" },
  { orgId: "15", name: "전남", abbr: "전남" },
  { orgId: "16", name: "경북", abbr: "경북" },
  { orgId: "17", name: "경남", abbr: "경남" },
  { orgId: "18", name: "제주", abbr: "제주" },
  { orgId: "2283", name: "해외", abbr: "해외" }
];

export function getProvinceByOrgId(orgId: string) {
  return BKPLAY_PROVINCES.find((province) => province.orgId === orgId);
}

export function formatProvinceScope(provinceName: string) {
  return provinceName === "전체 지역" ? provinceName : `${provinceName} 전체`;
}
