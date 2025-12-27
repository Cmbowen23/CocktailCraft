import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Copy, Check, ArrowRight, Loader2, AlertCircle } from "lucide-react";

const AcceptInvitationPage = () => {
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const url = window.location.href;
      console.log("[AcceptInvitation] Current URL:", url);

      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const t = params.get("token");

      console.log("[AcceptInvitation] Token:", t ? "present" : "missing");

      // Only require token to show the "valid" state.
      // We are NOT asking Base44 to validate it.
      if (!t) {
        setStatus("error");
        setMessage("This invitation link is missing a token or is invalid.");
        return;
      }

      setToken(t);
      setStatus("ready");
      setMessage(
        "Your invitation link is valid. Create your CocktailCraft account to continue."
      );
    } catch (err) {
      console.error("[AcceptInvitation] Error parsing URL:", err);
      setStatus("error");
      setMessage("There was a problem reading this invitation link.");
    }
  }, []);

  const handleGoHome = () => {
    window.location.href = "/";
  };

  const handleGoSignup = () => {
    // Store token and redirect
    if (token) {
        localStorage.setItem('cc_invite_token', token);
    }
    
    // Attempt to redirect to signup if available, otherwise login
    // Note: The hosted auth page might default to 'Sign In'
    if (base44.auth.redirectToSignup && typeof base44.auth.redirectToSignup === 'function') {
        base44.auth.redirectToSignup('/');
    } else {
        base44.auth.redirectToLogin('/');
    }
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoLogin = () => {
    base44.auth.redirectToLogin('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-semibold text-gray-800">
          Accept Invitation
        </h1>

        {status === "loading" && (
          <p className="text-sm text-gray-600">
            Checking your invitation…
          </p>
        )}

        {status === "error" && (
          <>
            <p className="mb-4 text-sm text-red-600">{message}</p>
            <button
              type="button"
              onClick={handleGoHome}
              className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {status === "ready" && (
          <>
            <p className="mb-6 text-sm text-gray-700 text-center">{message}</p>
            
            <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
              <p className="mb-2 text-xs text-blue-600 font-semibold uppercase tracking-wider text-center">Your Access Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white border-2 border-blue-100 px-4 py-3 text-2xl font-mono font-bold text-blue-900 tracking-[0.2em] text-center shadow-sm">
                  {token}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="flex h-[58px] w-[58px] items-center justify-center rounded-lg bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm group"
                  title="Copy code"
                >
                  {copied ? <Check className="h-6 w-6 text-green-500" /> : <Copy className="h-6 w-6 group-hover:scale-110 transition-transform" />}
                </button>
              </div>
              <p className="mt-3 text-xs text-center text-blue-400 font-medium">
                {copied ? <span className="text-green-600 flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Copied to clipboard!</span> : "Copy this code to use during sign up"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleGoSignup}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue to Sign Up <ArrowRight className="w-4 h-4" />
              </button>
              
              <div className="flex items-start gap-2 px-2 py-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 text-left">
                  <strong>Note:</strong> On the next screen, please verify you are on the <strong>Sign Up</strong> tab to create your new account.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoLogin}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Already have an account? Log In
              </button>

              <button
                type="button"
                onClick={handleGoHome}
                className="rounded border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitationPage;