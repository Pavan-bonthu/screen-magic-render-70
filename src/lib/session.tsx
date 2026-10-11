import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/auth.function";

export type Role = "admin" | "Engineer";

export type AppSession = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export async function loadSession(): Promise<AppSession | null> {
  return (await getMe()) as AppSession | null;
}

export function useSession() {
  return useQuery({
    queryKey: ["app-session"],
    queryFn: loadSession,
    staleTime: 60_000,
  });
}