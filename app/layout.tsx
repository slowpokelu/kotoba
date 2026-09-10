import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ことば — 四文字のパズル',
  description:
    'ひらがな4文字、8回のチャンス。毎日遊べる日本語の言葉当てパズル。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t='system';try{var s=localStorage.getItem('kotoba:theme');if(['system','light','dark'].includes(s))t=s;}catch(e){}document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
