import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WarmupPing } from "@/components/WarmupPing";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StadiumSetu — Real-Time Fan Experience",
  description: "Connect with fellow fans, participate in live polls, and feel the roar of the stadium from your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const targetAttrs = ['bis_skin_checked', 'cz-shortcut-listen'];
                const removeAttrs = (node) => {
                  if (node.nodeType === 1) {
                    targetAttrs.forEach(attr => {
                      if (node.hasAttribute(attr)) node.removeAttribute(attr);
                    });
                  }
                  node.childNodes?.forEach(removeAttrs);
                };
                
                // Clean initial DOM
                removeAttrs(document.documentElement);
                
                // Watch for dynamically added attributes or nodes
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && targetAttrs.includes(mutation.attributeName)) {
                      mutation.target.removeAttribute(mutation.attributeName);
                    } else if (mutation.type === 'childList') {
                      mutation.addedNodes.forEach(removeAttrs);
                    }
                  });
                });
                
                observer.observe(document.documentElement, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  attributeFilter: targetAttrs
                });
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <WarmupPing />
        {children}
      </body>
    </html>
  );
}
