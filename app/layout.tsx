import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ことば · Kotoba',
  description: 'A Japanese word puzzle',
  openGraph: {
    title: 'ことば · Kotoba',
    description: 'A Japanese word puzzle',
    type: 'website',
    url: 'https://slowpokelu.github.io/kotoba/',
  },
  twitter: {
    card: 'summary',
    title: 'ことば · Kotoba',
    description: 'A Japanese word puzzle',
  },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
