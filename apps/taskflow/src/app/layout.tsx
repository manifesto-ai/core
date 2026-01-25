import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow - Intent-Native Task Management",
  description: "A demo app showcasing Intent-Native architecture where LLMs emit validated intents executed by a deterministic runtime. Built on @manifesto-ai/core.",
  keywords: ["task management", "AI", "LLM", "intent-native", "manifesto", "natural language"],
  authors: [{ name: "Manifesto AI" }],
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicon-96x96.png",
  },
  openGraph: {
    title: "TaskFlow - Intent-Native Task Management",
    description: "A demo app where LLMs drive UI through validated intents, not direct state mutation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
