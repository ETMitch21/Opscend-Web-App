export interface ReceivablesSummary {
  totalOutstandingCents: number;
  openBalanceCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  mismatchCount: number;
  dataIssueCount: number;
  unassignedOrderCount: number;
}

export interface ReceivableCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface ReceivableRepair {
  id: string;
  status: string;
  problemSummary: string;
  deviceName: string | null;
}

export interface ReceivableLastPayment {
  amountCents: number;
  method: string;
  createdAt: string;
}

export interface ReceivableRow {
  orderId: string;
  orderNumber: string;
  source: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  netPaidCents: number;
  storedBalanceCents: number;
  balanceCents: number;
  balanceMismatch: boolean;
  isReceivable: boolean;
  dataIssues: string[];
  canVoid: boolean;
  customer: ReceivableCustomer | null;
  repair: ReceivableRepair | null;
  lastPayment: ReceivableLastPayment | null;
}

export interface ReceivablesSnapshot {
  summary: ReceivablesSummary;
  rows: ReceivableRow[];
  generatedAt: string;
}

export interface ReceivablesResponse {
  data: ReceivablesSnapshot;
}
