import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { BlobBackground } from '@/components/ui/BlobBackground';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jbmono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Finance Hub',
  description:
    'Personal finance dashboard for cashflow, targets, and account balances. Connect your own Supabase project.',
};

/* Anti-flash theme: read localStorage before first paint.
   Default light; dark is stored at "finance-hub:theme" → html[data-theme].
   Privacy starts on (html.privacy) so balances stay hidden until the eye toggle. */
const themeInitScript = `(function(){try{var t=localStorage.getItem('finance-hub:theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}document.documentElement.classList.add('privacy');try{localStorage.removeItem('finance-hub:privacy')}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${jakarta.variable} ${jbmono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <BlobBackground />
        <AuthProvider>
          <NotificationProvider>
            <FinanceProvider>{children}</FinanceProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
