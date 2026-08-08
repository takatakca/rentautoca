import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { UIMessage } from "ai";

export interface ConciergeThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useConciergeThreads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["concierge-threads", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ConciergeThread[]> => {
      const { data, error } = await supabase
        .from("concierge_threads")
        .select("id,title,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConciergeMessages(threadId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["concierge-messages", threadId],
    enabled: !!threadId && !!user,
    queryFn: async (): Promise<UIMessage[]> => {
      const { data, error } = await supabase
        .from("concierge_messages")
        .select("id,message,created_at")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const m = row.message as unknown as UIMessage;
        return { ...m, id: m?.id ?? row.id };
      });
    },
  });
}

export function useConciergeActions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const createThread = useCallback(
    async (title?: string) => {
      if (!user) throw new Error("Sign in to use the concierge.");
      const { data, error } = await supabase
        .from("concierge_threads")
        .insert({ user_id: user.id, title: title?.slice(0, 60) || "New conversation" })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["concierge-threads", user.id] });
      return data.id as string;
    },
    [user, qc],
  );

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("concierge_threads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["concierge-threads", user?.id] }),
  });

  return { createThread, deleteThread };
}
