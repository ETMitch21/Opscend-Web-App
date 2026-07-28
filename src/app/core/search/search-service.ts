import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../app-config/app-config.service';

export type SearchItemType =
  | 'customer'
  | 'repair'
  | 'appointment'
  | 'device'
  | 'quote'
  | 'order'
  | 'conversation'
  | 'form'
  | 'product'
  | 'purchase_order';

export type SearchItem = {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string | null;
  badge: string | null;
  meta: string | null;
  route: string;
};

export type GlobalSearchResponse = {
  customers: SearchItem[];
  repairs: SearchItem[];
  devices: SearchItem[];
  quotes: SearchItem[];
  orders: SearchItem[];
  conversations: SearchItem[];
  forms: SearchItem[];
  products: SearchItem[];
  purchaseOrders: SearchItem[];
  appointments: SearchItem[];
};

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  search(query: string, limit = 4): Observable<GlobalSearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', String(limit));

    return this.http.get<GlobalSearchResponse>(`${this.apiBase}/search`, { params });
  }
}
