import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gatekeeper: the refund autopilot that knows when to stop",
  description:
    "An autonomous refund-triage agent on Qwen that auto-resolves the routine and refuses to act on the risky, escalating to a human with its reasoning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
