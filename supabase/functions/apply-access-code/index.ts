import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { code } = await req.json();

    // If no code provided (skip option), just mark onboarding complete
    if (!code || code.trim() === "") {
      // First check if profile exists
      const { data: existingProfile } = await supabaseClient
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: insertError } = await supabaseClient
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            role: "user",
            user_type: "internal",
            onboarding_complete: true,
          });

        if (insertError) {
          console.error("Error creating profile:", insertError);
          return new Response(
            JSON.stringify({ success: false, message: "Failed to create profile", error: insertError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // Update existing profile
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({ onboarding_complete: true })
          .eq("id", user.id);

        if (updateError) {
          console.error("Error updating profile:", updateError);
          return new Response(
            JSON.stringify({ success: false, message: "Failed to update profile", error: updateError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Onboarding completed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate access code
    const { data: accessCode, error: codeError } = await supabaseClient
      .from("access_codes")
      .select("*")
      .eq("code", code.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (codeError) {
      console.error("Error fetching access code:", codeError);
      return new Response(
        JSON.stringify({ success: false, message: "Error validating code" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!accessCode) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid access code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if code has expired
    if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: "Access code has expired" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if code has reached max uses
    if (accessCode.max_uses && accessCode.current_uses >= accessCode.max_uses) {
      return new Response(
        JSON.stringify({ success: false, message: "Access code has reached maximum uses" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update user profile with access code details
    const profileUpdate: any = {
      id: user.id,
      email: user.email,
      role: accessCode.role,
      user_type: accessCode.user_type,
      onboarding_complete: true,
    };

    if (accessCode.account_id) {
      profileUpdate.account_id = accessCode.account_id;
    }

    if (accessCode.assigned_account_ids && Array.isArray(accessCode.assigned_account_ids)) {
      profileUpdate.assigned_account_ids = accessCode.assigned_account_ids;
    }

    // Use upsert to handle both insert and update cases
    const { error: upsertError } = await supabaseClient
      .from("profiles")
      .upsert(profileUpdate, { onConflict: "id" });

    if (upsertError) {
      console.error("Error upserting profile:", upsertError);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to update profile", error: upsertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Increment code usage count
    const { error: incrementError } = await supabaseClient
      .from("access_codes")
      .update({ current_uses: accessCode.current_uses + 1 })
      .eq("id", accessCode.id);

    if (incrementError) {
      console.error("Error incrementing code usage:", incrementError);
      // Don't fail the request if we can't increment the counter
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Access code applied successfully",
        profile: profileUpdate
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});