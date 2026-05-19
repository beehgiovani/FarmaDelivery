import { createClient } from "@supabase/supabase-js";

const runtimeEnv = import.meta.env ?? {};
const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL;
const publishableKey = runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase =
  supabaseUrl && publishableKey
    ? createClient(supabaseUrl, publishableKey, {
        realtime: {
          params: {
            eventsPerSecond: 5,
          },
        },
      })
    : null;
