/**
 * 저장소 어댑터.
 * 지금은 localStorage. 서버/DB로 옮길 때 이 파일의 load/save만 교체하면 된다.
 * (예: fetch("/api/state") ↔ POST "/api/state")
 */
const KEY = "posting-monitor:v1";

export async function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export async function clearState() {
  localStorage.removeItem(KEY);
}
