"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const res = await fetch("/api/conversations");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json.conversations;
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
