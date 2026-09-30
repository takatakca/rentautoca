// Shared TAKATAK Supabase client for Rentauto.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

type RentautoDatabase = {
  rentauto: Database["public"];
};

const TAKATAK_SUPABASE_URL =
  import.meta.env.VITE_TAKATAK_SUPABASE_URL ||
  "https://pcjfahhlozsseqqevimi.supabase.co";

const TAKATAK_SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_TAKATAK_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_DKcKo_UMmp1cix9vVTr0fA_TFW4ryk0";

// Rentauto uses the shared TAKATAK Auth project and the isolated `rentauto`
// database schema. The publishable key is browser-safe by design; privileged
// service-role and provider secrets stay server-side.
export const supabase = createClient<RentautoDatabase>(
  TAKATAK_SUPABASE_URL,
  TAKATAK_SUPABASE_PUBLISHABLE_KEY,
  {
    db: { schema: "rentauto" },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
