import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AuthRedirect() {
  useEffect(() => {
    // If Base44 sends us to /login?from_url=..., we should NOT bounce to /authentication.
    // In preview sandboxes, /login may be handled by the SPA, so we must explicitly kick
    // off the hosted Base44 login flow.
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("from_url");

    // Return-to should be the full current URL by default (works in preview + custom domain)
    const returnTo = fromUrl ? decodeURIComponent(fromUrl) : window.location.href;

    try {
      base44.auth.redirectToLogin(returnTo);
    } catch (e) {
      // Fallback: if SDK redirect fails for any reason, at least go to a safe page
      window.location.href = "/authentication";
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-gray-600 font-medium">Redirecting to login...</p>
      </div>
    </div>
  );
}
