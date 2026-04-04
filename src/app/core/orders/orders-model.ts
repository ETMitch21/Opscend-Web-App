export type FulfillmentStatus = 'fulfilled' | 'unfulfilled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'voided';
export type OrderSource = 'pos' | 'booking' | 'online';
export type PaymentMethod = 'cash' | 'card' | 'other';
export type OrderItemType = 'product' | 'service';
export type OrderPaymentType = 'payment' | 'refund';

export interface OrderItem {
  id: string;
  type: OrderItemType;
  name: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  notes: string | null;
}

export interface OrderPayment {
  id: string;
  type: OrderPaymentType;
  method: PaymentMethod;
  reference: string | null;
  amountCents: number;
  note: string | null;
  createdAt: string;
  createdBy: string;
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
}

export interface OrderExternalRefs {
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  bookingId: string | null;
  sourceOrderId: string | null;
}

export interface Order {
  id: string;
  shopId: string;
  orderNumber: string;
  sequence: number;
  customerId: string | null;
  source: OrderSource;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  tags: string[];
  notes: string | null;
  items: OrderItem[];
  payments: OrderPayment[];
  totals: OrderTotals;
  externalRefs: OrderExternalRefs;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface OrderListResponse {
  data: Order[];
  nextCursor: string | null;
}

export interface CreateOrderItemPayload {
  type: OrderItemType;
  name: string;
  sku?: string | null;
  quantity: number;
  unitPriceCents: number;
  notes?: string | null;
}

export interface CreateOrderPayload {
  shopId?: string;
  customerId?: string | null;
  source?: OrderSource;
  tags?: string[];
  notes?: string | null;
  externalRefs?: Partial<OrderExternalRefs>;
  items: CreateOrderItemPayload[];
  discountCents?: number;
}

export interface ReplaceOrderItemsPayload {
  items: CreateOrderItemPayload[];
  discountCents?: number;
}

export interface PatchOrderPayload {
  customerId?: string | null;
  fulfillmentStatus?: FulfillmentStatus;
  tags?: string[];
  notes?: string | null;
  externalRefs?: Partial<OrderExternalRefs>;
}

export interface CreatePaymentPayload {
  amountCents: number;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
}

export interface CreateRefundPayload {
  amountCents: number;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
}