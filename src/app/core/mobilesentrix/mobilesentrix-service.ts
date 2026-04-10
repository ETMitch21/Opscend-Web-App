import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  MobileSentrixDisconnectResponse,
  MobileSentrixStatusResponse,
} from "./mobilesentrix-model";

@Injectable({
  providedIn: "root",
})
export class MobileSentrixService {
  private readonly baseUrl = `${environment.apiBase}/integrations/mobilesentrix`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<MobileSentrixStatusResponse> {
    return this.http.get<MobileSentrixStatusResponse>(`${this.baseUrl}/status`);
  }

  connect(): void {
    const callbackUrl = `${environment.apiBase}/integrations/mobilesentrix/callback`;

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
}