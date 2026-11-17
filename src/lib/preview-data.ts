/**
 * DEV-ONLY empty fixture for UI preview (NEXT_PUBLIC_UI_PREVIEW=1, non-production).
 * A fresh account has no rows. Do not put real transactions here.
 */
import type { AssetItem, RecoveryItem, Transaction } from '@/types/finance';

export const PREVIEW_TRANSACTIONS: Transaction[] = [];
export const PREVIEW_RECOVERY_ITEMS: RecoveryItem[] = [];
export const PREVIEW_ASSETS: AssetItem[] = [];
