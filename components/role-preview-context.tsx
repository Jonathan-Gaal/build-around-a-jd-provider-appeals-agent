"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyPreviewAction, initialRolePreview, previewStateSchema, type PreviewAction, type RolePreviewState } from "@/lib/client/role-preview";

const storageKey = "wellline-role-preview-v1";
const RoleContext = createContext<{ state: RolePreviewState; ready: boolean; storageError: boolean; act: (action: PreviewAction) => void; reset: () => void } | null>(null);
export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialRolePreview);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try { const saved = previewStateSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? "null")); if (saved.success) setState(saved.data); }
    catch { setStorageError(true); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { setStorageError(true); } } }, [state, ready]);
  function act(action: PreviewAction) {
    const at = new Date().toISOString(), id = crypto.randomUUID();
    setState(current => applyPreviewAction(current, action, at, id));
  }
  function reset() { setState(initialRolePreview); }
  return <RoleContext.Provider value={{ state, ready, storageError, act, reset }}>{children}</RoleContext.Provider>;
}
export function useRolePreview() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("Role preview provider is required");
  return context;
}
