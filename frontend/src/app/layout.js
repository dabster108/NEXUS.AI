import { ViewTransition } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import "./tokens.css";
import "./globals.css";
import "./ui.css";
import "./shell.css";

/**
 * Inter for everything a person reads, Geist Mono for everything a machine
 * produced — paths, branches, ports, tool names. Keeping those two apart is
 * what lets a path sit inside a sentence without being mistaken for prose.
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "NEXUS.ai",
  description: "A local AI operating layer for macOS.",
  icons: {
    icon: "/brand-mark.svg",
    apple: "/logo.png",
  },
};

/**
 * Runs synchronously in <head>, before first paint, so the page never flashes
 * the wrong theme. `nexus-theme` is "light" | "dark" | "system" (default).
 * Wrapped in try/catch because storage can throw in private windows.
 */
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("nexus-theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">
        {/* Route changes are transitions, so this crossfades between the
            landing page and the app with no further wiring. */}
        <ViewTransition>{children}</ViewTransition>
      </body>
    </html>
  );
}
