export type ContractorPayoutStatus =
  | 'pending'
  | 'held'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'disputed'
  | 'canceled';

export type ContractorPayoutEntryType = 'repair' | 'adjustment';

export interface ContractorPayout {
  id: string;

  contractorId: string;
  contractorName: string | null;
  contractorEmail: string | null;

  repairId: string | null;
  repairSummary: string | null;
  repairStatus: string | null;

  assignmentId: string | null;

  type: ContractorPayoutEntryType;

  laborCents: number | null;
  partsCents: number | null;
  totalCents: number;

  currency: string;

  status: ContractorPayoutStatus;

  note: string | null;

  approvedAt: string | null;
  approvedBy: string | null;

  processingAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;

  stripeShopDebitPaymentId: string | null;
  stripeShopDebitAccountId: string | null;
  stripeShopDebitAmountCents: number | null;
  stripeShopDebitFeeCents: number | null;

  stripeTransferId: string | null;
  stripePayoutId: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ContractorPayoutListQuery {
  status?: ContractorPayoutStatus | 'all';
}

export interface UpdateContractorPayoutStatusRequest {
  status: ContractorPayoutStatus;
}

export interface ContractorPayoutBalance {
  stripeConnectedAccountId: string;
  availableCents: number;
  pendingCents: number;
  currency: string;
  available: unknown[];
  pending: unknown[];
}