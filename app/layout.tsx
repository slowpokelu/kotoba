import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ことば · Kotoba',
  description: '日本語の言葉当てパズル。8回以内に正解を見つけよう。',
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
