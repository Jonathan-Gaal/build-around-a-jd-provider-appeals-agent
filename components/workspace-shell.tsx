"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { isRole, roleHome, ROLE_LABELS } from "@/lib/auth/roles";
import { MotionConfig, motion } from "motion/react";

const ThemeContext = createContext({ night: false, toggle: () => {} });
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [night, setNight] = useState(false);
  useEffect(() => { setNight(localStorage.getItem("wellline-theme") === "night"); }, []);
  function toggle() { setNight(value => { localStorage.setItem("wellline-theme", value ? "day" : "night"); return !value; }); }
  return <ThemeContext.Provider value={{ night, toggle }}><MotionConfig reducedMotion="user">{children}</MotionConfig></ThemeContext.Provider>;
}
export const useWorkspaceTheme = () => useContext(ThemeContext);
export const panelClass = (night: boolean) => `min-w-0 rounded-xl border p-4 sm:p-6 ${night ? "border-[#304b3b] bg-[#1b2e26]" : "border-[#dce5de] bg-white"}`;
export const mutedClass = (night: boolean) => night ? "text-[#a9bbad]" : "text-[#687c6d]";
export const buttonClass = "inline-flex items-center justify-center rounded-lg bg-[#255e4b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1f513f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6a9b76]";

const clinicianLinks = [{ href: "/", label: "Work queue" }, { href: "/my-reviews", label: "My reviews" }, { href: "/requests", label: "Requests" }, { href: "/activity", label: "Activity" }];
export function WorkspaceShell({ children, title, caseNavigation, headerDetail }: { children: ReactNode; title: string; caseNavigation?: ReactNode; headerDetail?: ReactNode }) {
  const { night, toggle } = useWorkspaceTheme();
  const path = usePathname();
  const [identity, setIdentity] = useState<{ name?: string | null; role: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then(response => response.json()).then((session: { user?: { name?: string | null; role: string } }) => { if (active) setIdentity(session.user ?? null); }).catch(() => { if (active) setIdentity(null); });
    return () => { active = false; };
  }, [path]);
  const roleLabel = identity && isRole(identity.role) ? ROLE_LABELS[identity.role] : "Workspace";
  const home = identity ? roleHome(identity.role) : "/";
  const links = identity?.role === "clinician" ? clinicianLinks : identity ? [{ href: home, label: roleLabel + " workspace" }] : [];
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationButton = useRef<HTMLButtonElement>(null);
  const muted = mutedClass(night);
  return <div className={`min-h-screen ${night ? "bg-[#13211d] text-[#e6efe9]" : "bg-[#f7f8f7] text-[#1d392f]"}`}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4 focus:text-[#255e4b]">Skip to content</a>
    <div className="grid min-h-screen grid-rows-[auto_1fr] lg:grid-cols-[224px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className={`flex flex-col border-b p-5 lg:border-b-0 lg:border-r ${night ? "border-[#294137] bg-[#182b23]" : "border-[#dce5de] bg-[#eef2ee]"}`}>
        <div className="flex items-center justify-between gap-3"><Link href={home} aria-label="Wellline Review, back to your workspace" className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#255e4b] font-serif text-xl font-bold text-white">W</span><span><strong className="block text-sm">Wellline Review</strong><small className={`block text-[10px] tracking-wider ${muted}`}>{roleLabel.toUpperCase()} WORKSPACE</small></span></Link><button ref={navigationButton} type="button" aria-expanded={navigationOpen} aria-controls="workspace-navigation" onClick={() => setNavigationOpen(value => !value)} className="min-h-11 shrink-0 rounded-lg border border-current/20 px-3 text-xs font-semibold lg:hidden">{navigationOpen ? "Close menu" : "Menu"}</button></div>
        <div id="workspace-navigation" onClick={event => { if ((event.target as HTMLElement).closest("a")) setNavigationOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { setNavigationOpen(false); navigationButton.current?.focus(); } }} className={`${navigationOpen ? "flex" : "hidden"} flex-1 flex-col lg:flex`}>
        <p className={`mt-9 text-[10px] font-semibold tracking-widest ${muted}`}>WORKSPACE</p>
        <nav aria-label="Workspace" className="mt-3 flex flex-wrap gap-1 lg:block">{links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${path === link.href ? night ? "bg-[#2b5140] font-semibold" : "bg-[#dfeae2] font-semibold" : `${muted} hover:bg-[#649b72]/10`}`}>{link.label}</Link>)}</nav>
        {caseNavigation && <><p className={`mt-7 text-[10px] font-semibold tracking-widest ${muted}`}>CASE REVIEW</p>{caseNavigation}</>}
        <p className={`mt-7 text-[10px] font-semibold tracking-widest ${muted}`}>ACCOUNT</p>
        {identity?.role === "clinician" && <nav aria-label="Account" className={`mt-2 flex gap-3 text-sm lg:block ${muted}`}><Link href="/profile" className="block rounded-lg px-3 py-2 hover:bg-[#649b72]/10">Profile</Link><Link href="/notifications" className="block rounded-lg px-3 py-2 hover:bg-[#649b72]/10">Notifications</Link></nav>}
        <div className={`mt-8 rounded-lg border p-3 text-xs lg:mt-auto ${night ? "border-[#345644] bg-[#213a2d] text-[#b8cebb]" : "border-[#d4e4d8] bg-[#e6f0e7] text-[#476555]"}`}><strong className="block">SYNTHETIC DATA</strong><p className="mt-1">Fictional case · Human review</p><p className="mt-1">No payer submission</p></div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className={`flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 lg:px-10 ${night ? "border-[#294137] bg-[#1b2d26]" : "border-[#dce5de] bg-white"}`}><span className={`min-w-0 basis-full text-xs sm:basis-auto sm:text-sm ${muted}`}>{title}</span><div className="flex min-w-0 w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4"><span className={`min-w-0 text-xs ${muted}`}>{headerDetail ?? "All times Eastern"}</span><button onClick={toggle} type="button" className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${night ? "bg-[#2d4a3a]" : "bg-[#e9f2e9]"}`}>{night ? "☀ Day mode" : "☾ Night mode"}</button><details className="group relative"><summary aria-label="Open account menu" className={`flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-xs font-bold ${night ? "bg-[#345544]" : "bg-[#e7efe8]"}`}>{roleLabel.slice(0, 2).toUpperCase()}</summary><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute right-0 z-40 mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-xl border p-4 shadow-lg ${night ? "border-[#345644] bg-[#1b2d26]" : "border-[#dce5de] bg-white"}`}><strong className="text-sm">{identity?.name ?? "Signed-in account"}</strong><p className={`mt-1 text-xs ${muted}`}>{roleLabel}</p><div className="mt-4 space-y-1 text-sm">{identity?.role === "clinician" && <><Link href="/profile" className="block rounded-lg p-2 hover:bg-[#649b72]/10">Profile settings →</Link><Link href="/notifications" className="block rounded-lg p-2 hover:bg-[#649b72]/10">Notification preferences →</Link></>}<button onClick={toggle} type="button" className="w-full rounded-lg p-2 text-left hover:bg-[#649b72]/10">Appearance · {night ? "Night" : "Day"}</button><button onClick={() => signOut({ callbackUrl: "/login" })} type="button" className="w-full border-t border-current/10 p-2 text-left">Sign out</button></div></motion.div></details></div></header>
        <main id="main-content" className="mx-auto min-w-0 max-w-[1440px] px-4 py-6 [overflow-wrap:anywhere] sm:px-6 sm:py-9 lg:px-10"><motion.div key={path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>{children}</motion.div></main>
      </div>
    </div>
  </div>;
}
