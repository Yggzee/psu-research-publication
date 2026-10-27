import { apiService, type AIChatSession, type AIChatMessage } from "../services/api.service";
import { getCurrentUser } from "./researchStore";

const STORAGE_PREFIX = "psu_campus_ai_sessions_";

export function getChatStorageKey(userId?: string): string {
  const current = getCurrentUser();
  const id = userId || current.id || current.instructorId || current.username || "guest";
  return `${STORAGE_PREFIX}${id}`;
}

/**
 * Read cached sessions from localStorage (instant 0ms response)
 */
export function getLocalChatSessions(userId?: string): AIChatSession[] {
  try {
    const key = getChatStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[ChatHistoryStore] Failed to read local sessions:", err);
    return [];
  }
}

/**
 * Save sessions locally to localStorage
 */
export function setLocalChatSessions(sessions: AIChatSession[], userId?: string): void {
  try {
    const key = getChatStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent("campus-ai-history-updated", { detail: { count: sessions.length } }));
  } catch (err) {
    console.warn("[ChatHistoryStore] Failed to save local sessions:", err);
  }
}

/**
 * Fetch sessions from API and reconcile with local storage
 */
export async function fetchAndSyncChatSessions(userId?: string): Promise<AIChatSession[]> {
  const current = getCurrentUser();
  const effectiveUserId = userId || current.id || current.instructorId || current.username || "guest";
  
  const local = getLocalChatSessions(effectiveUserId);

  try {
    const res = await apiService.getAIChatSessions(effectiveUserId);
    if (res && Array.isArray(res.sessions)) {
      // Merge: if server has sessions, reconcile them
      const serverSessions = res.sessions;
      const sessionMap = new Map<string, AIChatSession>();

      // Put server sessions in map
      for (const s of serverSessions) {
        sessionMap.set(s.id, s);
      }

      // Check if local has newer or un-synced sessions
      for (const loc of local) {
        const serv = sessionMap.get(loc.id);
        if (!serv) {
          // Push local to server in background
          apiService.saveAIChatSession(loc).catch(() => {});
          sessionMap.set(loc.id, loc);
        } else if (new Date(loc.updatedAt).getTime() > new Date(serv.updatedAt).getTime()) {
          apiService.saveAIChatSession(loc).catch(() => {});
          sessionMap.set(loc.id, loc);
        }
      }

      const merged = Array.from(sessionMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setLocalChatSessions(merged, effectiveUserId);
      return merged;
    }
  } catch (err) {
    console.warn("[ChatHistoryStore] API sync failed, relying on local cache:", err);
  }

  return local;
}

/**
 * Save or update a single session
 */
export async function persistChatSession(session: AIChatSession, userId?: string): Promise<void> {
  const current = getCurrentUser();
  const effectiveUserId = userId || current.id || current.instructorId || current.username || "guest";
  
  const local = getLocalChatSessions(effectiveUserId);
  const existingIdx = local.findIndex((s) => s.id === session.id);
  
  let updatedList: AIChatSession[];
  if (existingIdx >= 0) {
    updatedList = [...local];
    updatedList[existingIdx] = session;
  } else {
    updatedList = [session, ...local];
  }

  // Sort by updatedAt DESC
  updatedList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  setLocalChatSessions(updatedList, effectiveUserId);

  // Sync to backend asynchronously
  try {
    await apiService.saveAIChatSession({
      id: session.id,
      userId: effectiveUserId,
      title: session.title,
      messages: session.messages,
    });
  } catch (err) {
    console.warn("[ChatHistoryStore] Failed to persist session to backend:", err);
  }
}

/**
 * Delete a specific session
 */
export async function deleteChatSession(sessionId: string, userId?: string): Promise<void> {
  const current = getCurrentUser();
  const effectiveUserId = userId || current.id || current.instructorId || current.username || "guest";

  const local = getLocalChatSessions(effectiveUserId);
  const filtered = local.filter((s) => s.id !== sessionId);
  setLocalChatSessions(filtered, effectiveUserId);

  try {
    await apiService.deleteAIChatSession(sessionId);
  } catch (err) {
    console.warn("[ChatHistoryStore] Failed to delete session on backend:", err);
  }
}

/**
 * Clear all chat sessions for user
 */
export async function clearAllChatSessions(userId?: string): Promise<void> {
  const current = getCurrentUser();
  const effectiveUserId = userId || current.id || current.instructorId || current.username || "guest";

  setLocalChatSessions([], effectiveUserId);

  try {
    await apiService.clearAIChatHistory(effectiveUserId);
  } catch (err) {
    console.warn("[ChatHistoryStore] Failed to clear all sessions on backend:", err);
  }
}
