import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "engineer";

export type AppSession = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export async function loadSession(): Promise<AppSession | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const isAdmin = (roles ?? []).some((r) => r.role === "admin");

  return {
    userId: user.id,
    email: profile?.email || user.email || "",
    name:
      profile?.full_name ||
      (user.user_metadata as { full_name?: string } | null)?.full_name ||
      (user.email ?? "").split("@")[0] ||
      "Engineer",
    role: isAdmin ? "admin" : "engineer",
  };
}

export function useSession() {
  return useQuery({
    queryKey: ["app-session"],
    queryFn: loadSession,
    staleTime: 60_000,
  });
}
