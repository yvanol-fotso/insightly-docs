import { useCallback, useEffect, useState } from "react";
import { deleteSession, listSessions, renameSession } from "../api/ragApi";
import type { ConversationEntry } from "../types";

/** Loads the conversation list and exposes rename / delete (optimistic). */
export function useConversations(refreshKey: number) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((list) => {
        if (!cancelled) setConversations(list);
      })
      .catch((err) => console.error("Failed to load conversations", err));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const rename = useCallback(async (sessionId: string, title: string) => {
    let previous: ConversationEntry[] = [];
    setConversations((list) => {
      previous = list;
      return list.map((c) => (c.session_id === sessionId ? { ...c, title } : c));
    });
    try {
      await renameSession(sessionId, title);
    } catch (err) {
      setConversations(previous);
      throw err;
    }
  }, []);

  const remove = useCallback(async (sessionId: string) => {
    let previous: ConversationEntry[] = [];
    setConversations((list) => {
      previous = list;
      return list.filter((c) => c.session_id !== sessionId);
    });
    try {
      await deleteSession(sessionId);
    } catch (err) {
      setConversations(previous);
      throw err;
    }
  }, []);

  return { conversations, rename, remove };
}
