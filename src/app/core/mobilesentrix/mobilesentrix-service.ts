import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  MobileSentrixDisconnectResponse,
  MobileSentrixSearchParams,
  MobileSentrixSearchResponse,
  MobileSentrixStatusResponse,
} from "./mobilesentrix-model";
import { ShopService } from "../shop/shop-service";

@Injectable({
  providedIn: "root",
})
export class MobileSentrixService {
  private readonly baseUrl = `${environment.apiBase}/integrations/mobilesentrix`;
  private shopId: string = "";

  constructor(private http: HttpClient, private shopService: ShopService) {
    this.shopService.getMyShop().subscribe((shop) => {
      if (shop && shop.id) {
        this.shopId = shop.id;
      }
    })
  }

  getStatus(): Observable<MobileSentrixStatusResponse> {
    return this.http.get<MobileSentrixStatusResponse>(`${this.baseUrl}/status`);
  }

  connect(): void {
    if (!this.shopId) return;

    const callbackUrl = `${window.location.origin}/api/v1/integrations/mobilesentrix/callback/${encodeURIComponent(this.shopId)}`;

    const url =
      `${environment.mobilesentrixUrl}/oauth/authorize/identifier` +
      `?consumer=${encodeURIComponent(environment.mobilesentrixConsumerName)}` +
      `&authtype=1` +
      `&flowentry=SignIn` +
      `&consumer_key=${encodeURIComponent(environment.mobilesentrixConsumerKey)}` +
      `&consumer_secret=${encodeURIComponent(environment.mobilesentrixConsumerSecret)}` +
      `&callback=${encodeURIComponent(callbackUrl)}`;

    window.location.href = url;
  }

  disconnect(): Observable<MobileSentrixDisconnectResponse> {
    return this.http.delete<MobileSentrixDisconnectResponse>(`${this.baseUrl}`);
  }

  search(params: MobileSentrixSearchParams): Observable<MobileSentrixSearchResponse> {
    let httpParams = new HttpParams().set('q', params.q);

    if (params.maxResults != null) {
      httpParams = httpParams.set('max_results', params.maxResults);
    }

    if (params.startIndex != null) {
      httpParams = httpParams.set('start_index', params.startIndex);
    }

    return this.http.get<MobileSentrixSearchResponse>(`${this.baseUrl}/search-products`, {
      params: httpParams,
    });
  }
}