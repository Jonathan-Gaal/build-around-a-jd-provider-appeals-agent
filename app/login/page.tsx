"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("clinician_a");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await signIn("credentials", { account, credential, redirect: false });
      if (result?.error) { setError("Sign-in failed. Check your demo credential."); return; }
      router.replace("/"); router.refresh();
    } catch { setError("Sign-in is unavailable. Check the local demo setup."); }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f2] px-5 py-10 text-[#1e3e31]">
      <div className="w-full max-w-md rounded-2xl border border-[#dce5de] bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-[#255e4b] font-serif text-2xl font-bold text-white">W</span><span className="font-semibold">Wellline Review</span></div>
        <p className="mt-10 text-xs font-bold tracking-widest text-[#5c806a]">SYNTHETIC DEMO</p>
        <h1 className="mt-2 font-serif text-3xl">Workspace sign-in</h1>
        <p className="mt-2 text-sm text-[#63786c]">Sign in with your own fictional account. Your assigned role determines your workspace and permissions.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-semibold">Account<select autoComplete="username" value={account} onChange={e => setAccount(e.target.value)} className="mt-2 block w-full rounded-lg border border-[#cbd9ce] bg-white px-4 py-3 outline-none focus:border-[#255e4b]"><option value="clinician_a">Clinician A · clinician_a</option><option value="clinician_b">Clinician B · clinician_b</option><option value="coordinator_a">Coordinator · coordinator_a</option><option value="manager_a">Manager · manager_a</option><option value="packet_a">Packet preparation · packet_a</option></select></label>
          <label className="block text-sm font-semibold">Demo credential<input required type="password" autoComplete="current-password" value={credential} onChange={e => setCredential(e.target.value)} className="mt-2 block w-full rounded-lg border border-[#cbd9ce] px-4 py-3 outline-none focus:border-[#255e4b]" /></label>
          {error && <p role="alert" className="text-sm text-[#a3453d]">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-[#255e4b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d4e3d] disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <Link href="/demo" className="mt-6 flex items-center justify-center rounded-lg border border-[#255e4b] px-4 py-3 text-sm font-semibold text-[#255e4b] hover:bg-[#255e4b]/5">Watch the demo <span aria-hidden="true" className="ml-2">▶</span></Link>
        <p className="mt-7 text-xs text-[#849187]">Synthetic data only. No payer submission.</p>
      </div>
    </main>
  );
}
