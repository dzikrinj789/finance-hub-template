import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Masuk | Finance Hub',
  description:
    'Finance Hub – Personal Wealth & Recovery Dashboard. Masuk untuk mengelola saldo aset, cashflow, dan target pemulihan modal.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}