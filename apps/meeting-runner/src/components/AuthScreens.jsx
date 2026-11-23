import { LogIn, Settings } from "lucide-react";
import { signIn } from "@/api/m365";

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-rs-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-rs-line border-t-4 border-t-rs-red p-8 shadow-sm">
        <img src={`${import.meta.env.BASE_URL}brand/rs-logo-horizontal-dark.png`} alt="Richards Supply Company" className="h-7 w-auto mb-8" />
        {children}
      </div>
    </div>
  );
}

export function SignInScreen() {
  return (
    <Shell>
      <p className="text-xs font-semibold tracking-[0.2em] text-rs-red uppercase mb-2">Meeting Planner</p>
      <h1 className="font-heading text-2xl font-extrabold text-rs-ink mb-2">MeetingRunner</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Sign in with your Richards Supply Microsoft 365 account to open your team's agendas.
      </p>
      <button
        onClick={() => signIn()}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-rs-red text-white text-sm font-medium rounded-xl hover:bg-rs-red-deep transition-colors"
      >
        <LogIn className="w-4 h-4" /> Sign in with Microsoft
      </button>
    </Shell>
  );
}

export function NotConfiguredScreen() {
  return (
    <Shell>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2 flex items-center gap-2">
        <Settings className="w-5 h-5" /> Setup needed
      </h1>
      <p className="text-sm text-neutral-500 mb-4">
        MeetingRunner doesn't have its Microsoft 365 settings yet. Fill in <code className="bg-neutral-100 px-1 rounded">meeting-runner/config.js</code> in
        the ai-training repo (tenant ID, app client ID and SharePoint site), then reload.
      </p>
      <p className="text-sm text-neutral-500">The steps are in the repo README under "MeetingRunner".</p>
    </Shell>
  );
}

export function AuthErrorScreen({ message }) {
  return (
    <Shell>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Couldn't sign in</h1>
      <p className="text-sm text-neutral-500 mb-6 break-words">{message || "Something went wrong."}</p>
      <button
        onClick={() => signIn()}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-rs-red text-white text-sm font-medium rounded-xl hover:bg-rs-red-deep transition-colors"
      >
        <LogIn className="w-4 h-4" /> Try again
      </button>
    </Shell>
  );
}
