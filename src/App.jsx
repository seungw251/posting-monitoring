import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import ColFilter from "./components/ColFilter.jsx";
import Auth from "./components/Auth.jsx";
import { isConfigured } from "./lib/supabase.js";
import { getSession, onAuthChange, signOut } from "./lib/auth.js";
import { fmt, fmtShort, num, uid, timeAgo, stamp } from "./lib/format.js";
import { CHANNELS, DEFAULT_RATES, migrateRates, rateFor, tierLabel } from "./lib/rates.js";
import { cellVal, checkUrl, computeRow, isStory, postType } from "./lib/posting.js";
import { parseWorkbook, exportRows } from "./lib/excel.js";
import { syncRows } from "./lib/sync.js";
import { loadState, saveState } from "./lib/storage.js";
import { DEFAULT_PROJECT, PALETTE } from "./data/seed.js";

/* 리스트 컬럼 — value: 체크박스 다중 필터 / num: 정렬 전용 */
const TABS = ["Total", "AD Value", "PR Value"];

/* 리스트 컬럼 정의 — value: 체크박스 다중 필터 / num: 정렬 전용 */
const COLS = [
  { key: "date", label: "Posting Date", kind: "value", align: "l" },
  { key: "name", label: "Name / URL", kind: "value", align: "l" },
  { key: "postingUrl", label: "Posting URL", kind: "value", align: "l" },
  { key: "posting", label: "Posting", kind: "num" },
  { key: "follower", label: "Follower", kind: "num" },
  { key: "impression", label: "Impression", kind: "num" },
  { key: "reach", label: "Reach", kind: "num" },
  { key: "view", label: "View", kind: "num" },
  { key: "like", label: "Like", kind: "num" },
  { key: "comment", label: "Comment", kind: "num" },
  { key: "eng", label: "Engagement", kind: "num" },
  { key: "adValue", label: "AD Value", kind: "num" },
  { key: "prValue", label: "PR Value", kind: "num" },
];

/* 컬럼 기본 가로폭(px) — 헤더 경계 드래그로 조절, localStorage에 저장 */
const DEFAULT_COLW = {
  date: 92, name: 190, postingUrl: 210, posting: 66, follower: 118, impression: 100,
  reach: 90, view: 104, like: 104, comment: 104, eng: 120, adValue: 108, prValue: 118,
};
const COLW_KEY = "posting-monitor:colw";

export default function App() {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([DEFAULT_PROJECT]);
  const [activeId, setActiveId] = useState(DEFAULT_PROJECT.id);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [lastSync, setLastSync] = useState({});
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(0);
  const [tab, setTab] = useState("Total");
  const [pOpen, setPOpen] = useState(false);
  const [pQuery, setPQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [sel, setSel] = useState([]);            // 선택된 행 id
  const [pending, setPending] = useState(null);     // 링크 오류 확인 대기
  const [upResult, setUpResult] = useState(null);   // 업로드 결과 요약
  const [projModal, setProjModal] = useState(null);
  const [, setTick] = useState(0);

  /* ── 인증 ── */
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [recovery, setRecovery] = useState(false);

  const ratesRef = useRef(DEFAULT_RATES);
  const rowsRef = useRef([]);
  const projRef = useRef([DEFAULT_PROJECT]);
  const activeRef = useRef(DEFAULT_PROJECT.id);
  const syncRef = useRef({});
  const tRef = useRef(null);

  useEffect(() => { ratesRef.current = rates; }, [rates]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { projRef.current = projects; }, [projects]);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);
  useEffect(() => { syncRef.current = lastSync; }, [lastSync]);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  /* 세션 로드 + 변화 구독 (비밀번호 재설정 이벤트 포함) */
  useEffect(() => {
    if (!isConfigured) return;
    let unsub;
    (async () => {
      setSession(await getSession());
      setAuthReady(true);
      unsub = onAuthChange((event, s) => {
        setSession(s);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      });
    })();
    return () => unsub && unsub();
  }, []);

  const doSignOut = async () => {
    try { await signOut(); } catch { /* 무시 */ }
    setSession(null); setRecovery(false);
    setRows([]); rowsRef.current = [];
    setReady(false);
  };

  const showToast = (m) => {
    setToast(m);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 3200);
  };

  const persist = useCallback(async (p = {}) => {
    try {
      await saveState({
        rows: p.rows ?? rowsRef.current,
        projects: p.projects ?? projRef.current,
        rates: p.rates ?? ratesRef.current,
        lastSync: p.lastSync ?? syncRef.current,
      });
    } catch {
      showToast("저장에 실패했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!isConfigured || !session) return;   // 로그인 사용자만 데이터 로드
    (async () => {
      try {
        const d = await loadState();
        if (d?.projects?.length) {
          const ps = d.projects;
          const rs = (d.rows || []).map((r) => ({ ...r, projectId: r.projectId || ps[0].id }));
          setProjects(ps); projRef.current = ps;
          setRows(rs); rowsRef.current = rs;
          if (d.rates?.ig) { const mr = migrateRates(d.rates); setRates(mr); ratesRef.current = mr; }
          if (d.lastSync) { setLastSync(d.lastSync); syncRef.current = d.lastSync; }
          setActiveId(ps[0].id); activeRef.current = ps[0].id;
        } else {
          // 최초 로드: 데모 데이터 없이 빈 기본 프로젝트 1개만 생성
          setProjects([DEFAULT_PROJECT]); projRef.current = [DEFAULT_PROJECT];
          setRows([]); rowsRef.current = [];
          setActiveId(DEFAULT_PROJECT.id); activeRef.current = DEFAULT_PROJECT.id;
          await persist({ rows: [], projects: [DEFAULT_PROJECT], rates: DEFAULT_RATES, lastSync: {} });
        }
      } catch (e) {
        showToast(`데이터를 불러오지 못했습니다: ${e.message}`);
      }
      setReady(true);
    })();
  }, [persist, session]);

  /* ── 행 선택 · 선택 삭제 ── */
  const toggleSel = (id) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const removeSelected = async () => {
    if (!sel.length) return;
    const del = new Set(sel);
    const n = sel.length;
    const next = rowsRef.current.filter((r) => !del.has(r.id));
    setRows(next); rowsRef.current = next;
    setSel([]);
    try {
      await persist({ rows: next });
      showToast(`${n}건 삭제되었습니다`);
    } catch (e) {
      showToast(`삭제에 실패했습니다: ${e.message}`);
    }
  };

  /* ── 동기화 (버튼 클릭 시에만) ── */
  const runSync = async () => {
    const pid = activeRef.current;
    const targets = rowsRef.current.filter((r) => r.projectId === pid);
    if (!targets.length) { showToast("동기화할 포스팅이 없습니다."); return; }
    setSyncing(1);
    try {
      const { updated, syncedAt: now, count } = await syncRows(targets, ratesRef.current, setSyncing);
      const next = rowsRef.current.map((r) => updated.get(r.id) || r);
      const ls = { ...syncRef.current, [pid]: now };
      setRows(next); rowsRef.current = next;
      setLastSync(ls); syncRef.current = ls;
      await persist({ rows: next, lastSync: ls });
      showToast(`${count}건 동기화 완료 · 지표가 갱신되었습니다`);
    } catch (err) {
      showToast(`동기화 실패: ${err.message}`);
    } finally {
      setSyncing(0);
    }
  };

  /* ── 포스팅 CRUD ── */
  /* ── 포스팅 등록 = 엑셀 업로드 (중복 자동 제외) ── */
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const pid = activeRef.current;
      const parsed = await parseWorkbook(file, pid, ratesRef.current);

      const rowsOk = parsed.filter((r) => r.name && r.date);
      const invalid = parsed.length - rowsOk.length;

      if (!rowsOk.length) {
        showToast("인식할 수 있는 행이 없습니다. 컬럼명(Posting Date, Name, Posting URL, Follower…)을 확인해 주세요.");
        return;
      }

      /* 중복 체크 없음 — 엑셀의 모든 유효 행을 그대로 등록 */
      const fresh = rowsOk, dups = [];

      /* 링크 유효성 — 등록 대상 중 오류 건 분리 */
      const good = [], bad = [];
      for (const r of fresh) {
        const chk = checkUrl(r.postingUrl);
        chk.ok ? good.push(r) : bad.push({ ...r, reason: chk.reason });
      }

      const meta = { file: file.name, total: parsed.length, dup: dups.length, invalid,
                     dupList: dups.slice(0, 6) };

      /* 링크 오류가 있으면 사용자에게 선택을 받고, 없으면 바로 등록 */
      if (bad.length) {
        setPending({ ...meta, good, bad });
      } else {
        await commitUpload(good, { ...meta, badKept: 0, badRemoved: 0 });
      }
    } catch {
      showToast("파일을 읽지 못했습니다. .xlsx 형식인지 확인해 주세요.");
    }
  };

  const commitUpload = async (list, meta) => {
    if (list.length) {
      const next = [...rowsRef.current, ...list];
      setRows(next); rowsRef.current = next;
      await persist({ rows: next });
    }
    setPending(null);
    setUpResult({ ...meta, added: list.length });
  };

  /* ── 프로젝트 ── */
  const openProj = () => { setPOpen(false); setProjModal({ list: projects.map((p) => ({ ...p })), newName: "", confirmDel: null }); };

  const quickAdd = async () => {
    setPOpen(false); setPQuery("");
    const p = { id: uid(), name: `새 프로젝트 ${projects.length + 1}`, color: PALETTE[projects.length % PALETTE.length] };
    const list = [...projects, p];
    setProjects(list); projRef.current = list;
    setActiveId(p.id); activeRef.current = p.id;
    await persist({ projects: list });
    showToast(`"${p.name}" 생성됨 · 포스팅을 등록해 주세요`);
  };

  const saveProjects = async () => {
    const pm = projModal;
    let list = pm.list.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name);
    if (pm.newName.trim())
      list = [...list, { id: uid(), name: pm.newName.trim(), color: PALETTE[list.length % PALETTE.length] }];
    if (!list.length) { showToast("프로젝트는 최소 1개 필요합니다"); return; }
    const seen = new Set();
    for (const p of list) {
      if (seen.has(p.name)) { showToast(`프로젝트 이름이 중복됩니다: ${p.name}`); return; }
      seen.add(p.name);
    }
    const kept = new Set(list.map((p) => p.id));
    const removed = rows.filter((r) => !kept.has(r.projectId)).length;
    const nextRows = rows.filter((r) => kept.has(r.projectId));
    setProjects(list); projRef.current = list;
    setRows(nextRows); rowsRef.current = nextRows;
    if (!kept.has(activeId)) { setActiveId(list[0].id); activeRef.current = list[0].id; }
    setProjModal(null);
    await persist({ projects: list, rows: nextRows });
    showToast(`프로젝트가 저장되었습니다${removed ? ` · 포스팅 ${removed}건 함께 삭제` : ""}`);
  };

  /* ── 밸류 기준표 (AD / PR 탭에서 인라인 편집) ── */
  const [draft, setDraft] = useState(null);   // 편집 중 사본
  const [rateCh, setRateCh] = useState("ig"); // 채널 탭

  useEffect(() => {
    if (tab === "AD Value" || tab === "PR Value") setDraft(JSON.parse(JSON.stringify(rates)));
    else setDraft(null);
  }, [tab, rates]);

  const dirty = draft && JSON.stringify(draft) !== JSON.stringify(rates);
  const key = tab === "PR Value" ? "pr" : "ad";

  const setTier = (i, field, v) => setDraft((d) => ({ ...d,
    [rateCh]: d[rateCh].map((t, j) => j === i ? { ...t, [field]: v } : t) }));

  const addTier = () => setDraft((d) => ({ ...d, [rateCh]: [...d[rateCh], { min: 0, ad: 0, pr: 0 }] }));
  const delTier = (i) => setDraft((d) => ({ ...d, [rateCh]: d[rateCh].filter((_, j) => j !== i) }));

  const autoFillPr = () => setDraft((d) => ({ ...d,
    [rateCh]: d[rateCh].map((t) => ({ ...t, pr: num(t.ad) * 5 })) }));

  const saveRates = async () => {
    const clean = {};
    for (const ch of Object.keys(CHANNELS)) {
      clean[ch] = (draft[ch] || [])
        .map((t) => ({ min: num(t.min), ad: num(t.ad), pr: num(t.pr) }))
        .filter((t) => t.ad > 0 || t.pr > 0)
        .sort((a, b) => a.min - b.min);
      if (!clean[ch].length) { showToast(`${CHANNELS[ch]} 기준을 1개 이상 입력해 주세요`); return; }
    }
    setRates(clean); ratesRef.current = clean;
    await persist({ rates: clean });
    showToast("밸류 기준이 저장되었습니다 · 동기화 실행 시 기존 건에도 반영됩니다");
  };

  const projRows = useMemo(() => rows.filter((r) => r.projectId === activeId), [rows, activeId]);

  useEffect(() => { setSel([]); }, [activeId, tab]);

  /* ── 컬럼 멀티필터 ── */
  const [colF, setColF] = useState({});                       // {key: [선택된 값]}
  const [sortC, setSortC] = useState({ key: "date", dir: "desc" });
  const [openCol, setOpenCol] = useState(null);

  useEffect(() => { setColF({}); }, [activeId]);

  /* ── 컬럼 가로폭 (헤더 경계 드래그) ── */
  const [colW, setColW] = useState(() => {
    try { return { ...DEFAULT_COLW, ...JSON.parse(localStorage.getItem(COLW_KEY) || "{}") }; }
    catch { return { ...DEFAULT_COLW }; }
  });
  useEffect(() => { try { localStorage.setItem(COLW_KEY, JSON.stringify(colW)); } catch { /* 무시 */ } }, [colW]);

  const startResize = (key, e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[key] ?? DEFAULT_COLW[key] ?? 100;
    const onMove = (ev) => setColW((c) => ({ ...c, [key]: Math.max(48, startW + (ev.clientX - startX)) }));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const resetCol = (key) => setColW((c) => ({ ...c, [key]: DEFAULT_COLW[key] }));
  const colWidth = (key) => colW[key] ?? DEFAULT_COLW[key];
  // 폭을 비율(%)로 렌더 → 표는 항상 컨테이너 폭(100%)에 맞고, 리사이즈는 비율만 바꿈(가로 스크롤 없음).
  const totalW = 40 + 44 + COLS.reduce((a, c) => a + colWidth(c.key), 0);
  const pct = (w) => `${(w / totalW) * 100}%`;

  const colValues = useCallback((key) => {
    const set = new Set(projRows.map((r) => cellVal(r, key)));
    return [...set].sort((a, b) => String(a).localeCompare(String(b), "ko"));
  }, [projRows]);

  const filtered = useMemo(() => {
    const out = projRows.filter((r) =>
      Object.entries(colF).every(([k, vals]) => !vals.length || vals.includes(cellVal(r, k))));
    const { key, dir } = sortC;
    const sign = dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const x = cellVal(a, key), y = cellVal(b, key);
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return String(x).localeCompare(String(y), "ko") * sign;
    });
  }, [projRows, colF, sortC]);

  const activeFilters = Object.values(colF).filter((v) => v.length).length;
  const clearFilters = () => { setColF({}); setSortC({ key: "date", dir: "desc" }); };

  const kpi = useMemo(() => {
    const k = filtered.reduce((a, r) => ({
      post: a.post + (r.posting || 1), imp: a.imp + r.impression, reach: a.reach + r.reach,
      view: a.view + (r.view || 0), like: a.like + (r.like || 0), comment: a.comment + (r.comment || 0),
      eng: a.eng + (r.like || 0) + (r.comment || 0), ad: a.ad + r.adValue, pr: a.pr + r.prValue,
      follower: a.follower + (r.follower || 0),
      story: a.story + (isStory(r.postingUrl) ? (r.posting || 1) : 0),
      urlCnt: a.urlCnt + (isStory(r.postingUrl) ? 0 : 1),
    }), { post: 0, imp: 0, reach: 0, view: 0, like: 0, comment: 0, eng: 0, ad: 0, pr: 0,
          follower: 0, story: 0, urlCnt: 0 });
    k.influencers = new Set(filtered.map((r) => r.name)).size;
    return k;
  }, [filtered]);


  /* ── 인증 게이트 (모든 훅 이후) ── */
  if (!isConfigured) return <ConfigNeeded />;
  if (!authReady) return <Splash msg="불러오는 중…" />;
  if (recovery) return <Auth recovery onRecoveryDone={() => setRecovery(false)} />;
  if (!session) return <Auth />;

  const active = projects.find((p) => p.id === activeId) || DEFAULT_PROJECT;
  const syncedAt = lastSync[activeId];
  const stale = !syncedAt || (Date.now() - new Date(syncedAt)) > 3600000;
  const allSelected = filtered.length > 0 && sel.length === filtered.length;
  const someSelected = sel.length > 0 && !allSelected;
  const pList = projects.filter((p) => p.name.toLowerCase().includes(pQuery.toLowerCase()));

  return (
    <div className="pm" onClick={() => { if (pOpen) setPOpen(false); if (openCol) setOpenCol(null); }}>

      {/* ══ 상단 바 — 프로젝트 스위처 ══ */}
      <div className="tb">
        <div className="tb-in">
          <div className="tb-logo">P</div>
          <span className="tb-name">Posting Monitor</span>
          <span className="tb-sep">/</span>

          <div className="pswitch" onClick={(e) => e.stopPropagation()}>
            <button className="pbtn" onClick={() => { setPOpen((v) => !v); setPQuery(""); }} aria-expanded={pOpen}>
              <span className="sw" style={{ background: active.color }} />
              {active.name}
              <em>{projRows.length}</em>
              <span className="car">▾</span>
            </button>
            {pOpen && (
              <div className="pmenu" role="menu">
                <div className="pmenu-h">
                  <b>프로젝트 전환</b>
                  <input autoFocus placeholder="프로젝트 검색" value={pQuery}
                    onChange={(e) => setPQuery(e.target.value)} aria-label="프로젝트 검색" />
                </div>
                <div className="pmenu-l">
                  {pList.length === 0 ? (
                    <div className="pmenu-e">검색 결과가 없습니다</div>
                  ) : pList.map((p) => (
                    <button key={p.id} className={p.id === activeId ? "on" : ""}
                      onClick={() => { setActiveId(p.id); setPOpen(false); setPQuery(""); }}>
                      <span className="chk">{p.id === activeId ? "✓" : ""}</span>
                      <span className="sw" style={{ background: p.color }} />
                      <span>{p.name}</span>
                      <i>{rows.filter((r) => r.projectId === p.id).length}</i>
                    </button>
                  ))}
                </div>
                <div className="pmenu-f">
                  <button onClick={quickAdd}>＋ 새 프로젝트 생성</button>
                  <button onClick={openProj}>⚙ 프로젝트 관리 (이름 변경 · 삭제)</button>
                </div>
              </div>
            )}
          </div>

          <div className="tb-r">
            <div className="tb-sync">
              <span>LAST SYNC</span>
              <b className={stale ? "stale" : ""}>
                <span className="ldot" />
                {syncedAt ? `${stamp(syncedAt)} · ${timeAgo(syncedAt)}` : "동기화 필요"}
              </b>
            </div>
            <div className="tb-user">
              <span className="tb-uemail" title={session.user?.email}>{session.user?.email}</span>
              <button className="tb-ubtn" onClick={doSignOut}>로그아웃</button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 탭 메뉴 ══ */}
      <div className="tabbar">
        <div className="tabbar-in">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t}
              className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
              {t}{t === "Total" && <i>{fmt(projRows.length)}</i>}
            </button>
          ))}
          <div className="tabacts">
            {tab === "Total" && <>
            <button className="btn acc" onClick={runSync} disabled={!!syncing || !projRows.length}>
              {syncing ? `동기화 ${syncing}%` : "⟳ 동기화"}
            </button>
            <button className="btn" onClick={() => {
              if (!filtered.length) { showToast("추출할 데이터가 없습니다."); return; }
              const nm = `${active.name}_포스팅_${new Date().toISOString().slice(0, 10)}`.replace(/[\\/:*?"<>|]/g, "_");
              exportRows(filtered, `${nm}.xlsx`);
              showToast(`${filtered.length}건을 엑셀로 추출했습니다`);
            }}>⤓ 엑셀 추출</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
            <button className="btn pri" onClick={() => fileRef.current?.click()}>＋ 포스팅 등록 (엑셀)</button>
            </>}
          </div>
        </div>
      </div>

      {/* ══ 본문 ══ */}
      <div className="wrap">
        {!!syncing && <div className="syncbar"><i style={{ width: `${syncing}%` }} /></div>}

{tab === "Total" ? (
      <>
        <div className="cards">
          <div className="card sum">
            <div className="card-h">
              <span className="card-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>◉</span>
              <b>Summary</b>
              <small>{filtered.length}건 합계</small>
            </div>
            <div className="sum-g">
              <div className="stat grp"><b>{fmt(filtered.length)}</b>
                <span>리스트 <i className="sub">(인플루언서 {fmt(kpi.influencers)})</i></span></div>
              <div className="stat grp"><b>{fmt(kpi.post)}</b>
                <span>포스팅 <i className="sub">(IG 스토리 {fmt(kpi.story)}, URL {fmt(kpi.post - kpi.story)})</i></span></div>
              <div className="stat"><b>{fmtShort(kpi.follower)}</b><span>Follower</span></div>
              <div className="stat"><b>{fmtShort(kpi.imp)}</b><span>Impression</span></div>
              <div className="stat"><b>{fmtShort(kpi.view)}</b><span>View</span></div>
              <div className="stat"><b>{fmt(kpi.like)}</b><span>Like</span></div>
              <div className="stat"><b>{fmt(kpi.comment)}</b><span>Comment</span></div>
              <div className="stat"><b>{fmt(kpi.eng)}</b><span>Engagement</span></div>
              <div className="stat"><b>₩{fmtShort(kpi.ad)}</b><span>AD Value</span></div>
              <div className="stat"><b>₩{fmtShort(kpi.pr)}</b><span>PR Value</span></div>
            </div>
          </div>
        </div>

        <div className="lmeta">
          <span>
            {filtered.length}건 표시 / 전체 {projRows.length}건
            {activeFilters > 0 && <> · 필터 {activeFilters}개 적용</>}
          </span>
          {(activeFilters > 0 || sortC.key !== "date" || sortC.dir !== "desc") && sel.length === 0 && (
            <button className="reset" onClick={clearFilters}>필터·정렬 초기화</button>
          )}
          {sel.length > 0 && (
            <div className="selbar">
              <b>{sel.length}건 선택됨</b>
              <button className="btn" onClick={() => setSel([])}>선택 해제</button>
              <button className="btn del" onClick={removeSelected}>선택 삭제</button>
            </div>
          )}
        </div>

        {/* ── 리스트 ── */}
        <div className="tblwrap">
          {!ready ? (
            <div className="empty">데이터를 불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {projRows.length === 0
                ? <>이 프로젝트에는 아직 포스팅이 없습니다.<br />＋ 포스팅 등록 버튼으로 추가해 주세요.</>
                : <>조건에 맞는 포스팅이 없습니다.<br />탭이나 필터를 조정해 보세요.</>}
            </div>
          ) : (
            <table className="resizable" style={{ width: "100%" }}>
              <colgroup>
                <col style={{ width: pct(40) }} />
                <col style={{ width: pct(44) }} />
                {COLS.map((c) => <col key={c.key} style={{ width: pct(colWidth(c.key)) }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="l chk">
                    <input type="checkbox" aria-label="전체 선택"
                      checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={() => setSel(allSelected ? [] : filtered.map((r) => r.id))} />
                  </th>
                  <th className="l no">No.</th>
                  {COLS.map((c) => {
                    const on = (colF[c.key] || []).length > 0;
                    const sorted = sortC.key === c.key;
                    return (
                      <th key={c.key} className={c.align === "l" ? "l fh" : "fh"}>
                        <span className="fh-in">
                          {c.label}
                          {sorted && <em>{sortC.dir === "asc" ? "▲" : "▼"}</em>}
                          <button className={`fbtn ${on ? "on" : ""}`} aria-label={`${c.label} 필터`}
                            onClick={(e) => { e.stopPropagation(); setOpenCol(openCol === c.key ? null : c.key); }}>
                            ▽
                          </button>
                        </span>
                        {openCol === c.key && (
                          <ColFilter
                            col={c}
                            values={c.kind === "value" ? colValues(c.key) : []}
                            applied={colF[c.key]}
                            sort={sortC}
                            onSort={(k, d) => { setSortC({ key: k, dir: d }); setOpenCol(null); }}
                            onApply={(vals) => {
                              setColF((f) => { const n = { ...f }; vals.length ? n[c.key] = vals : delete n[c.key]; return n; });
                              setOpenCol(null);
                            }}
                            onClose={() => setOpenCol(null)}
                          />
                        )}
                        <span className="col-rz" title="드래그로 폭 조절 · 더블클릭 초기화"
                          onMouseDown={(e) => startResize(c.key, e)}
                          onDoubleClick={() => resetCol(c.key)} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const eng = (r.like || 0) + (r.comment || 0);
                  const story = isStory(r.postingUrl);
                  const chk = story ? null : checkUrl(r.postingUrl); // 행당 1회만 검증
                  const synced = !!r.syncedAt && !story; // 동기화로 실측된 포스팅
                  return (
                    <tr key={r.id} className={sel.includes(r.id) ? "on" : ""}>
                      <td className="l chk">
                        <input type="checkbox" aria-label={`${r.name} 선택`}
                          checked={sel.includes(r.id)} onChange={() => toggleSel(r.id)} />
                      </td>
                      <td className="l no">{i + 1}</td>
                      <td className="l date">{r.date}</td>
                      <td className="l">
                        <div className="who">
                          <div className="who-t">
                            <b>{r.name}</b>
                            {r.url
                              ? <a className="acc-url" href={r.url} target="_blank" rel="noreferrer" title={r.url}>
                                  {r.url}
                                </a>
                              : <small>계정 URL 없음</small>}
                          </div>
                        </div>
                      </td>
                      <td className="l">
                        <div className="post-c">
                          {story
                            ? <span className="story-txt">{r.postingUrl}</span>
                            : <a className={`plink ${chk.ok ? "" : "bad"}`}
                                href={r.postingUrl} target="_blank" rel="noreferrer"
                                title={chk.ok ? r.postingUrl : `링크 오류: ${chk.reason}`}>
                                {chk.ok ? "" : "⚠ "}{r.postingUrl}
                              </a>}
                        </div>
                      </td>
                      <td>{r.posting}</td>
                      <td>{fmt(r.follower)}<Delta prev={r.prev?.follower} cur={r.follower} /></td>
                      <td className="hot">{fmt(r.impression)}</td>
                      <td>{fmt(r.reach)}</td>
                      <td className={synced ? "synced" : ""}>{fmt(r.view)}<Delta prev={r.prev?.view} cur={r.view} /></td>
                      <td className={synced ? "synced" : ""}>{fmt(r.like)}<Delta prev={r.prev?.like} cur={r.like} /></td>
                      <td className={synced ? "synced" : ""}>{fmt(r.comment)}<Delta prev={r.prev?.comment} cur={r.comment} /></td>
                      <td className={`hot ${synced ? "synced" : ""}`}>{fmt(eng)}<Delta prev={r.prev ? (r.prev.like || 0) + (r.prev.comment || 0) : undefined} cur={eng} /></td>
                      <td>₩{fmt(r.adValue)}</td>
                      <td className="hot">₩{fmt(r.prValue)}</td>
                    </tr>
                  );
                })}
                <tr className="sumrow">
                  <td className="l" colSpan={5}>합계 ({filtered.length}건)</td>
                  <td>{fmt(kpi.post)}</td>
                  <td>–</td>
                  <td className="hot">{fmt(kpi.imp)}</td>
                  <td>{fmt(kpi.reach)}</td>
                  <td>{fmt(filtered.reduce((a, r) => a + r.view, 0))}</td>
                  <td>{fmt(filtered.reduce((a, r) => a + r.like, 0))}</td>
                  <td>{fmt(filtered.reduce((a, r) => a + r.comment, 0))}</td>
                  <td className="hot">{fmt(kpi.eng)}</td>
                  <td>₩{fmt(kpi.ad)}</td>
                  <td className="hot">₩{fmt(kpi.pr)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </>
      ) : (
      <>
        <div className="rate-wrap">
          <div className="rate-head">
            <div>
              <h2>{tab} 기준</h2>
              <p>
                {tab === "AD Value"
                  ? "팔로워 구간별 1건 AD Value 기준입니다. IG STORY는 50%로 계산되며, 포스팅 건수만큼 곱해집니다."
                  : "팔로워 구간별 1건 PR Value 기준입니다. 일반적으로 AD Value × 5이며, 필요하면 개별 수정할 수 있습니다."}
              </p>
            </div>
            <div className="rate-act">
              {tab === "PR Value" && (
                <button className="btn" onClick={autoFillPr}>AD × 5로 자동 채우기</button>
              )}
              {dirty && <button className="btn" onClick={() => setDraft(JSON.parse(JSON.stringify(rates)))}>
                변경 취소</button>}
              <button className="btn acc" onClick={saveRates} disabled={!dirty}>
                {dirty ? "기준 저장" : "저장됨"}
              </button>
            </div>
          </div>

          <div className="mtabs" role="tablist">
            {Object.entries(CHANNELS).map(([ch, label]) => (
              <button key={ch} role="tab" aria-selected={rateCh === ch}
                className={`mtab ${rateCh === ch ? "on" : ""}`} onClick={() => setRateCh(ch)}>
                {ch === "ig" ? "인플루언서 (IG)" : ch === "youtube" ? "유튜버" : "블로그"}
              </button>
            ))}
          </div>

          <div className="tblwrap">
            <table className="rate-tbl">
              <thead>
                <tr>
                  <th className="l">팔로워 구간</th>
                  <th className="l">기준값 (이상)</th>
                  <th className="l">AD Value</th>
                  <th className="l">PR Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {draft && [...(draft[rateCh] || [])].map((t, i) => (
                  <tr key={i} className={key === "ad" ? "hl-ad" : "hl-pr"}>
                    <td className="l tier">{tierLabel(draft[rateCh], i)}</td>
                    <td className="l">
                      <input className="in rin" type="number" value={t.min}
                        onChange={(e) => setTier(i, "min", e.target.value)} aria-label="팔로워 기준값" />
                    </td>
                    <td className="l">
                      <div className="won">
                        <span>₩</span>
                        <input className={`in rin ${key === "ad" ? "act" : ""}`} type="number" value={t.ad}
                          onChange={(e) => setTier(i, "ad", e.target.value)} aria-label="AD Value" />
                      </div>
                    </td>
                    <td className="l">
                      <div className="won">
                        <span>₩</span>
                        <input className={`in rin ${key === "pr" ? "act" : ""}`} type="number" value={t.pr}
                          onChange={(e) => setTier(i, "pr", e.target.value)} aria-label="PR Value" />
                      </div>
                    </td>
                    <td className="l">
                      <button className="ico" onClick={() => delTier(i)} aria-label="구간 삭제">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="addt" onClick={addTier}>＋ 구간 추가</button>
          <p className="note">
            AD Value = 구간 기준 × 포스팅 건수 · IG STORY는 50% 밸류 · 저장 후 동기화를 실행하면 기존 데이터에도 반영됩니다.
          </p>
        </div>

      </>
      )}
      </div>

      {/* ══ 링크 유효성 확인 (오류가 있을 때만) ══ */}
      {pending && (
        <div className="mbg" onClick={(e) => e.target === e.currentTarget && setPending(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
            <h3>포스팅 링크 오류 {pending.bad.length}건</h3>
            <p className="lead">
              {pending.file} · 등록 대상 {pending.good.length + pending.bad.length}건 중
              아래 {pending.bad.length}건의 링크 형식이 올바르지 않습니다. 어떻게 처리할까요?
            </p>

            <div className="up-box err">
              <ul>
                {pending.bad.slice(0, 8).map((r, i) => (
                  <li key={i}>
                    <b>{r.name}</b> · {r.postingUrl || "(빈 값)"} — {r.reason}
                  </li>
                ))}
              </ul>
              {pending.bad.length > 8 && <small>외 {pending.bad.length - 8}건</small>}
            </div>

            <p className="note">
              무시하고 등록하면 링크가 잘못된 상태로 저장되며, 지표 동기화 시 해당 건은 수집되지 않을 수 있습니다.
            </p>

            <div className="mft">
              <button className="btn" onClick={() => setPending(null)}>취소</button>
              <button className="btn" onClick={() => commitUpload(pending.good,
                { ...pending, badRemoved: pending.bad.length, badKept: 0 })}>
                오류 {pending.bad.length}건 삭제하고 등록
              </button>
              <button className="btn acc" onClick={() => commitUpload([...pending.good, ...pending.bad],
                { ...pending, badRemoved: 0, badKept: pending.bad.length })}>
                무시하고 모두 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 업로드 결과 ══ */}
      {upResult && (
        <div className="mbg" onClick={(e) => e.target === e.currentTarget && setUpResult(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
            <h3>업로드 완료</h3>
            <p className="lead">{upResult.file} · {active.name} 프로젝트</p>

            <div className="up-g">
              <div className="up-s ok"><b>{fmt(upResult.added)}</b><span>등록됨</span></div>
              <div className="up-s err"><b>{fmt(upResult.badRemoved || 0)}</b><span>링크 오류 제외</span></div>
              <div className="up-s"><b>{fmt(upResult.total)}</b><span>총 행수</span></div>
            </div>

            {upResult.badKept > 0 && (
              <div className="up-box err">
                <b>링크 오류 {upResult.badKept}건이 그대로 등록되었습니다</b>
                <small>리스트에서 확인 후 수정하거나 삭제해 주세요.</small>
              </div>
            )}

            {upResult.dup > 0 && (
              <div className="up-box warn">
                <b>중복으로 제외된 항목</b>
                <ul>
                  {upResult.dupList.map((r, i) => (
                    <li key={i}>{r.name} · {isStory(r.postingUrl) ? `IG STORY (${r.date})` : r.postingUrl}</li>
                  ))}
                </ul>
                {upResult.dup > upResult.dupList.length &&
                  <small>외 {upResult.dup - upResult.dupList.length}건</small>}
              </div>
            )}

            <p className="note">
              중복 체크 없이 엑셀의 모든 행을 등록합니다. 같은 파일을 다시 올리면 중복으로 쌓일 수 있으니 주의하세요.
            </p>
            <div className="mft">
              <button className="btn acc" onClick={() => setUpResult(null)}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 프로젝트 관리 ══ */}
      {projModal && (
        <div className="mbg" onClick={(e) => e.target === e.currentTarget && setProjModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
            <h3>프로젝트 관리</h3>
            <p className="lead">이름·색상 변경, 생성, 삭제를 한 번에 처리합니다.</p>
            {projModal.list.map((p, i) => {
              const c = rows.filter((r) => r.projectId === p.id).length;
              return (
                <div className="prow" key={p.id}>
                  <button className="pswatch" style={{ background: p.color }} aria-label="색상 변경"
                    onClick={() => setProjModal((m) => ({ ...m, list: m.list.map((x, j) => j === i
                      ? { ...x, color: PALETTE[(PALETTE.indexOf(x.color) + 1) % PALETTE.length] } : x) }))} />
                  <input className="in" value={p.name} aria-label="프로젝트 이름"
                    onChange={(e) => setProjModal((m) => ({ ...m,
                      list: m.list.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} />
                  <span className="pcnt">{c}건</span>
                  {projModal.confirmDel === p.id ? (
                    <button className="del2" onClick={() => setProjModal((m) => ({ ...m, confirmDel: null,
                      list: m.list.filter((x) => x.id !== p.id) }))}>삭제 확정</button>
                  ) : (
                    <button className="ico" aria-label="프로젝트 삭제"
                      onClick={() => setProjModal((m) => ({ ...m, confirmDel: p.id }))}>✕</button>
                  )}
                </div>
              );
            })}
            <div className="padd">
              <input className="in" placeholder="새 프로젝트 이름" value={projModal.newName}
                onChange={(e) => setProjModal((m) => ({ ...m, newName: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && saveProjects()} />
              <button className="btn" onClick={() => setProjModal((m) => m.newName.trim()
                ? { ...m, list: [...m.list, { id: uid(), name: m.newName.trim(),
                    color: PALETTE[m.list.length % PALETTE.length] }], newName: "" } : m)}>추가</button>
            </div>
            <p className="note">
              색상 사각형을 누르면 컬러가 바뀝니다. 프로젝트를 삭제하면 소속 포스팅도 함께 삭제되며,
              ✕ → "삭제 확정" → 하단 "저장"까지 눌러야 최종 반영됩니다.
            </p>
            <div className="mft">
              <button className="btn" onClick={() => setProjModal(null)}>취소</button>
              <button className="btn acc" onClick={saveProjects}>저장</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/* 이전 동기화 대비 증감 (▲상승 / ▼하락). prev 없으면 표시 안 함. */
function Delta({ prev, cur }) {
  if (prev == null) return null;
  const d = (cur || 0) - (prev || 0);
  if (!d) return null;
  const up = d > 0;
  return <i className={`dlt ${up ? "up" : "down"}`}>{up ? "▲" : "▼"}{fmt(Math.abs(d))}</i>;
}

function Splash({ msg }) {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">P</div>
        <p className="auth-sub">{msg}</p>
      </div>
    </div>
  );
}

function ConfigNeeded() {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">P</div>
        <h1>설정 필요</h1>
        <p className="auth-sub">
          Supabase 환경변수가 설정되지 않았습니다.<br />
          <code>VITE_SUPABASE_URL</code> 과 <code>VITE_SUPABASE_ANON_KEY</code> 를 설정한 뒤 다시 배포해 주세요.
        </p>
      </div>
    </div>
  );
}
