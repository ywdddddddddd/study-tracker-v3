import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oppoSerif = localFont({
  src: "../../public/fonts/oppo-serif.woff2",
  variable: "--font-oppo-serif",
  weight: "400",
});

export const metadata: Metadata = {
  title: "All in One 追踪系统",
  description: "考研筑基 · All in One 追踪系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${oppoSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=LXGW+WenKai&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex">
        <TooltipProvider>
          {children}
          <Toaster richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
