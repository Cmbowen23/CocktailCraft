import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setError(sessionError.message);
          setTimeout(() => navigate("/authentication"), 2000);
          return;
        }

        if (session) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("Profile error:", profileError);
          }

          if (!profile) {
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email,
                role: 'user',
                user_type: 'internal',
                onboarding_complete: false,
              });

            if (createError) {
              console.error("Error creating profile:", createError);
            }
          }

          navigate("/dashboard");
        } else {
          setError("No session found");
          setTimeout(() => navigate("/authentication"), 2000);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err.message);
        setTimeout(() => navigate("/authentication"), 2000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-white">
        {error ? (
          <>
            <div className="text-red-400 text-center">
              <p className="text-lg font-medium mb-2">Authentication Error</p>
              <p className="text-sm text-red-300">{error}</p>
              <p className="text-sm text-slate-400 mt-2">Redirecting to login...</p>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <p className="text-lg font-medium">Completing sign in...</p>
            <p className="text-sm text-slate-400">Please wait</p>
          </>
        )}
      </div>
    </div>
  );
}
