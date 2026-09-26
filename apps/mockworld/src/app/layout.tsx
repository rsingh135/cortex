import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MockLoft",
  description: "Fictional demo apps for the Cortex hackathon.",
};

const NAV = [
  { href: "/listings", label: "MockLoft" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-stone-300 bg-white">
          <nav aria-label="Apps" className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
            <span className="text-sm font-semibold tracking-wide text-stone-500">Maya&apos;s apps</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-base font-medium text-stone-800 hover:underline" data-nav={n.label.toLowerCase()}>
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">{children}</div>
        <footer className="border-t border-stone-300 bg-white">
          <p className="mx-auto max-w-5xl px-6 py-3 text-xs text-stone-500">Fictional demo apps for the Cortex hackathon. No real listings.</p>
        </footer>
      </body>
    </html>
  );
}
