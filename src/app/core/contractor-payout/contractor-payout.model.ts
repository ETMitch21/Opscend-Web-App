export type ContractorPayoutStatus =
  | 'pending'
  | 'approved'
  | 'paid'
  | 'disputed';

export type ContractorPayoutEntryType =
  | 'repair'
  | 'adjustment';

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

  status: ContractorPayoutStatus;

  note: string | null;

  createdAt: string;
}

export interface ContractorPayoutListQuery {
  status?: ContractorPayoutStatus | 'all';
}

export interface UpdateContractorPayoutStatusRequest {
  status: ContractorPayoutStatus;
}
