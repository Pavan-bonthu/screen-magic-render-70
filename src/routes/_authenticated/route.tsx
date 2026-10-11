import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/auth.function";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const me = await getMe();
    if (!me) throw redirect({ to: "/auth" });
    return { user: me };
  },
  component: () => <Outlet />,
});