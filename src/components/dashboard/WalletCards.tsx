'use client';

import type React from 'react';
import Image from 'next/image';

import {
  ArrowRight,
  Banknote,
  CandlestickChart,
  CreditCard,
  Gem,
  Landmark,
  PiggyBank,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatRupiah } from '@/lib/utils';
import { GlassCard } from '@/components/ui/minimal';

const WALLET_DOTS = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

/* Ikon jenis akun — berdasarkan tipe (label), dengan override ringan per brand. */
const TYPE_ICON: [RegExp, LucideIcon][] = [
  [/bank digital|digital bank|neo ?bank/i, Smartphone],
  [/kartu kredit|credit/i, CreditCard],
  [/rdn|saham|sekuritas|stock|broker/i, CandlestickChart],
  [/reksa ?dana|investasi|bibit/i, PiggyBank],
  [/e-?wallet|dompet digital|gopay|ovo|dana|shopee/i, Wallet],
  [/emas|gold/i, Gem],
  [/cash|tunai/i, Banknote],
  [/bank/i, Landmark],
];
const BRAND_TYPE: Record<string, string> = {
  'jago syariah': 'Bank Digital',
  jago: 'Bank Digital',
  mandiri: 'Bank',
  stockbit: 'RDN',
  bibit: 'Reksadana',
};
function walletTypeIcon(type: string, name: string): LucideIcon {
  const t = type || BRAND_TYPE[name.toLowerCase()] || '';
  for (const [re, icon] of TYPE_ICON) if (re.test(t)) return icon;
  return CreditCard;
}

/* Logo brand resmi (public/logos) — dicocokkan dari nama akun; lainnya pakai ikon tipe. */
const BRAND_LOGOS: { match: RegExp; src: string; brand: string; w: number; h: number }[] = [
  { match: /mandiri/i, src: '/logos/mandiri.svg', brand: 'Mandiri', w: 60, h: 17.5 },
  { match: /jago/i, src: '/logos/jago-syariah.svg', brand: 'Jago Syariah', w: 1085, h: 217 },
  { match: /stockbit/i, src: '/logos/stockbit.svg', brand: 'Stockbit', w: 527, h: 200 },
];
function brandLogo(name: string) {
  return BRAND_LOGOS.find((b) => b.match.test(name)) ?? null;
}

export function WalletCards({ className = 's7' }: { className?: string }) {
  const { assets, setActiveTab } = useFinance();
  const wallets = assets.filter((asset) => {
    if (asset.isGold || asset.name === 'Saham' || asset.name === 'Emas Fisik') return false;
    if (/piutang/i.test(`${asset.name} ${asset.displayName || ''} ${asset.subCategory || ''}`)) return false;
    return asset.category === 'likuid' || asset.subCategory === 'bank' || asset.subCategory === 'cash';
  });

  return (
    <GlassCard className={className}>
      <div className="row">
        <div className="lbl ttl">
          <CreditCard size={17} strokeWidth={2.2} />
          Dompet &amp; Akun
        </div>
        <button type="button" className="btn" style={{ padding: '7px 12px' }} onClick={() => setActiveTab('setup')}>
          Kelola <ArrowRight size={14} strokeWidth={2.3} />
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="empty">Belum ada akun. Tambahkan rekening atau dompet di Setup, lalu catat transaksi.</div>
      ) : (
        <div className="wallets">
          {wallets.map((asset, index) => {
            const dot = WALLET_DOTS[index % WALLET_DOTS.length];
            const logo = brandLogo(asset.name) ?? brandLogo(asset.displayName || '');
            const TypeIcon = walletTypeIcon(asset.subCategory || asset.category, asset.name);
            return (
              <div key={asset.id} className="wcard">
                <div className="row">
                  {logo ? (
                    <span className="wlogo">
                      <Image
                        src={logo.src}
                        alt={`${logo.brand} logo`}
                        width={logo.w}
                        height={logo.h}
                        unoptimized
                        draggable={false}
                      />
                    </span>
                  ) : (
                    <span className="wicon" style={{ '--wtint': dot } as React.CSSProperties} aria-hidden="true">
                      <TypeIcon size={19} strokeWidth={1.75} />
                    </span>
                  )}
                  <small className="wtype">{asset.subCategory || 'Akun'}</small>
                </div>
                <div>
                  <small className="wsub">Saldo</small>
                  <div className="amt money">{formatRupiah(asset.value)}</div>
                  <small className="wsync">tersinkron dari Setup</small>
                </div>
                <div className="row">
                  <b>
                    <span className="brand-dot" style={{ background: dot }} />
                    {asset.displayName || asset.name}
                  </b>
                  <TypeIcon size={16} strokeWidth={2.2} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
