// src/api/base44Client.js
// Base44 SHIM for migration (StackBlitz/Bolt).
// Purpose: stop redirects to base44.app and allow the UI to boot.
// Next steps will wire entities/functions/auth to Supabase.

function notImplemented(path) {
  const err = new Error(`Base44 shim not implemented: ${path}`);
  err.code = "BASE44_SHIM_NOT_IMPLEMENTED";
  throw err;
}

export const base44 = {
  auth: {
    // UI commonly calls these
    me: async () => null,
    signIn: async () => notImplemented("auth.signIn"),
    signOut: async () => null,
    getSession: async () => null,
  },

  // Entities will be swapped to Supabase next (Step 2)
  entities: new Proxy(
    {},
    {
      get(_target, prop) {
        return {
          list: async () => notImplemented(`entities.${String(prop)}.list`),
          get: async () => notImplemented(`entities.${String(prop)}.get`),
          create: async () => notImplemented(`entities.${String(prop)}.create`),
          update: async () => notImplemented(`entities.${String(prop)}.update`),
          delete: async () => notImplemented(`entities.${String(prop)}.delete`),
        };
      },
    }
  ),

  // Functions will be swapped to Supabase Edge Functions later
  functions: new Proxy(
    {},
    {
      get(_target, prop) {
        return async () => notImplemented(`functions.${String(prop)}`);
      },
    }
  ),

    integrations: {
    // Some parts of the app expect Base44 "LLM" integration helpers.
    // For now, return a safe stub so the UI can boot.
    InvokeLLM: async () => {
      throw new Error("Base44 shim not implemented: integrations.InvokeLLM");
    },

    // If the code calls other integration names, they’ll still fail clearly
    // but won’t crash on property access.
  },

};
