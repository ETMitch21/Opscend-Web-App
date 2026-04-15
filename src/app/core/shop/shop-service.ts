import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map } from "rxjs";
import { AppConfigService } from "../app-config/app-config.service";

export type ShopStatus = "active" | "inactive" | "suspended";
export type FulfillmentStatus = "fulfilled" | "unfulfilled";

export interface ShopAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  geo: {
    lat: number;
    lng: number;
  } | null;
}

export interface ShopBranding {
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface ShopOrderSettings {
  prefix: string | null;
  startNumber: number | null;
  padding: number | null;
  defaultFulfillmentStatus: FulfillmentStatus | null;
}

export interface ShopSettings {
  pos: {
    orders: ShopOrderSettings;
  };
  booking: {
    enabled: boolean;
  };
}

export interface ShopLocale {
  language: string;
  currency: string;
  country: string;
}

export interface Shop {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  status: ShopStatus;

  phone: string | null;
  email: string | null;
  timezone: string;

  address: ShopAddress | null;
  branding: ShopBranding;
  settings: ShopSettings;
  locale: ShopLocale;

  owner: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopsListResponse {
  data: Shop[];
  nextCursor: string | null;
}

@Injectable({ providedIn: "root" })
export class ShopService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  private readonly baseUrl = `${this.apiBase}/shops`;

  /**
   * Non-root callers get their own shop as the first item in GET /shops
   */
  getMyShop(): Observable<Shop | null> {
    return this.http.get<ShopsListResponse>(this.baseUrl).pipe(
      map((res) => res.data?.[0] ?? null)
    );
  }

  getShopById(id: string): Observable<Shop> {
    return this.http.get<Shop>(`${this.baseUrl}/${id}`);
  }

  updateShop(id: string, body: Partial<ShopUpdateBody>): Observable<Shop> {
    return this.http.patch<Shop>(`${this.baseUrl}/${id}`, body);
  }
}

/**
 * Frontend patch body matching backend PATCH /shops/:id shape
 */
export interface ShopUpdateBody {
  name?: string;
  legalName?: string;
  status?: ShopStatus;

  phone?: string | null;
  email?: string | null;
  timezone?: string;

  address?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    geo?: {
      lat: number;
      lng: number;
    } | null;
  } | null;

  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
  };

  settings?: {
    pos?: {
      orders?: {
        prefix?: string | null;
        startNumber?: number | null;
        padding?: number | null;
        defaultFulfillmentStatus?: FulfillmentStatus | null;
      };
    };
    booking?: {
      enabled?: boolean;
    };
  };

  locale?: {
    language?: string;
    currency?: string;
    country?: string;
  };
}