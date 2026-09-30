import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IOB LogDesk — Log analysis & ticket tracking" },
      { name: "description", content: "Collect client logs per ticket and track analysis for broker support." },
      { property: "og:title", content: "IOB LogDesk" },
      { property: "og:description", content: "Every log tells a trade story." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
