/**
 * 포스팅 밸류 기준 (포스팅 밸류 기준.xlsx)
 * AD Value = 구간 AD 단가 × 포스팅 건수 (IG STORY는 50%)
 * PR Value = 구간 PR 단가 × 포스팅 건수 (기본값 AD × 5)
 */
import { num } from "./format.js";

export const CHANNELS = { ig: "IG", youtube: "유튜버", blog: "블로그" };

export const DEFAULT_RATES = {
  ig: [
    { min: 0, ad: 500000, pr: 2500000 },
    { min: 10000, ad: 1000000, pr: 5000000 },
    { min: 50000, ad: 3000000, pr: 15000000 },
    { min: 100000, ad: 5000000, pr: 25000000 },
    { min: 250000, ad: 8000000, pr: 40000000 },
    { min: 500000, ad: 10000000, pr: 50000000 },
    { min: 750000, ad: 15000000, pr: 75000000 },
    { min: 1000000, ad: 20000000, pr: 100000000 },
  ],
  youtube: [
    { min: 0, ad: 1500000, pr: 7500000 },
    { min: 10000, ad: 3000000, pr: 15000000 },
    { min: 50000, ad: 9000000, pr: 45000000 },
    { min: 100000, ad: 15000000, pr: 75000000 },
    { min: 250000, ad: 24000000, pr: 120000000 },
    { min: 500000, ad: 30000000, pr: 150000000 },
    { min: 750000, ad: 45000000, pr: 225000000 },
    { min: 1000000, ad: 60000000, pr: 300000000 },
  ],
  blog: [{ min: 0, ad: 500000, pr: 2500000 }],
};

/** 구버전 저장 데이터({min, value}) 변환 */
export const migrateRates = (r) => {
  if (!r?.ig) return DEFAULT_RATES;
  const out = {};
  for (const ch of Object.keys(DEFAULT_RATES)) {
    const tiers = r[ch] || DEFAULT_RATES[ch];
    out[ch] = tiers.map((t) =>
      t.ad != null
        ? { min: num(t.min), ad: num(t.ad), pr: num(t.pr) }
        : { min: num(t.min), ad: num(t.value), pr: num(t.value) * 5 }
    );
  }
  return out;
};

export const rateFor = (follower, channel, rates) => {
  const tiers = [...(rates?.[channel] || rates?.ig || [])].sort((a, b) => a.min - b.min);
  let v = { ad: 0, pr: 0 };
  for (const t of tiers) if (follower >= t.min) v = { ad: num(t.ad), pr: num(t.pr) };
  return v;
};

/** "10,000 ~ 49,999" 형태의 구간 라벨 */
export const tierLabel = (tiers, i) => {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const cur = sorted[i];
  const next = sorted[i + 1];
  if (!cur) return "";
  const f = (n) => n.toLocaleString("ko-KR");
  if (cur.min === 0) return next ? `~ ${f(next.min - 1)}` : "전체";
  return next ? `${f(cur.min)} ~ ${f(next.min - 1)}` : `${f(cur.min)} ~`;
};
