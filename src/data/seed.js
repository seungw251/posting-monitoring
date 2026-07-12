/** 초기 시드 데이터 (인플루언서 포스팅 참고용 링크.xlsx) */
import { serialToISO, uid } from "../lib/format.js";
import { computeRow, dedupeKey } from "../lib/posting.js";
import { DEFAULT_RATES } from "../lib/rates.js";

export const PALETTE = ["#5B5BD6", "#DB2777", "#D97706", "#059669", "#2563EB", "#7C3AED", "#DC2626", "#0D9488"];
export const DEFAULT_PROJECT = { id: "p-default", name: "기본 프로젝트", color: "#5B5BD6" };

/* [date, name, url, postingUrl, posting, follower, view, like, comment] */
const SEED_RAW = [
  [46129,"안소미","https://www.instagram.com/a.ssom/","IG STORY",1,270000,0,0,0],
  [46135,"소리","https://www.instagram.com/solwlyy/","IG STORY",1,163000,0,0,0],
  [46135,"해리","https://www.instagram.com/harry_bloom/","IG STORY",1,322000,0,0,0],
  [46136,"수사샤","https://www.instagram.com/suesasha/","https://www.instagram.com/p/DXgobeRTtNH/",1,250000,38000,699,7],
  [46136,"유아정","https://www.instagram.com/ryu.xx___/","IG STORY",1,77000,0,0,0],
  [46137,"렐랴","https://www.instagram.com/_leliado/","https://www.instagram.com/p/DXjocMYE4Cm/",1,112000,30000,0,20],
  [46137,"렐랴","https://www.instagram.com/_leliado/","IG STORY",1,112000,0,0,0],
  [46137,"신유은","https://www.instagram.com/yuuxeun/","IG STORY",1,346000,0,0,0],
  [46137,"진솔","https://www.instagram.com/jinsolllllllshin/","IG STORY",1,147000,0,0,0],
  [46137,"유미","https://www.instagram.com/youuuuuume/","IG STORY",2,82000,0,0,0],
  [46138,"규원규진","https://www.instagram.com/q2han/","https://www.instagram.com/p/DXk2R6Dk-mt/",1,323000,0,2571,27],
  [46138,"규원규진","https://www.instagram.com/q2han/","IG STORY",1,323000,0,0,0],
  [46138,"박민주","https://www.instagram.com/mjbypp/","https://www.instagram.com/p/DXmKMmqSSzX/",1,172000,26000,401,10],
  [46138,"박민주","https://www.instagram.com/mjbypp/","IG STORY",4,172000,0,0,0],
  [46138,"배윤영","https://www.instagram.com/mulan_bae/","IG STORY",2,314000,0,0,0],
  [46138,"윤수빈","https://www.instagram.com/ysubini/","https://www.instagram.com/p/DXmT1elj05H/",1,204000,17000,301,13],
  [46139,"진솔","https://www.instagram.com/jinsolllllllshin/","IG STORY",1,147000,0,0,0],
  [46139,"윤수빈","https://www.instagram.com/ysubini/","IG STORY",3,204000,0,0,0],
  [46139,"배윤영","https://www.instagram.com/mulan_bae/","https://www.instagram.com/p/DXoWm-ZkVtx/",1,314000,0,1518,26],
  [46139,"누가영","https://www.instagram.com/nugayoung/","https://www.instagram.com/p/DXoeXj5Cftp/",1,429000,97000,714,20],
  [46139,"다샤","https://www.instagram.com/dahyeshka/","https://www.instagram.com/reel/DXom2vWj4p5/",1,191000,76000,3093,30],
];

export const seedRows = () => {
  const rows = SEED_RAW.map((r) => ({
    id: uid(),
    projectId: DEFAULT_PROJECT.id,
    ...computeRow(
      { date: serialToISO(r[0]), name: r[1], url: r[2], postingUrl: r[3],
        posting: r[4], follower: r[5], view: r[6], like: r[7], comment: r[8] },
      DEFAULT_RATES
    ),
  }));
  const seen = new Set();
  return rows.filter((r) => {
    const k = dedupeKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
