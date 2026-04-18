import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { StripeConnectResponse, StripeDisconnectResponse, StripeStatusResponse } from "./stripe-model";
import { AppConfigService } from "../app-config/app-config.service";

@Injectable({
    providedIn: "root",
})
export class StripeService {
    private readonly appConfig = inject(AppConfigService);
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${this.apiBase}/integrations/stripe`;

    private get apiBase(): string {
        return this.appConfig.config.apiBase;
    }

    getStatus(): Observable<StripeStatusResponse> {
        return this.http.get<StripeStatusResponse>(`${this.baseUrl}/status`);
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.http
                .post<StripeConnectResponse>(`${this.baseUrl}/connect/onboard`, {})
                .subscribe({
                    next: (res) => {
                        if (res?.url) {
                            window.location.href = res.url;
                            resolve();
                            return;
                        }

                        reject(new Error("Missing Stripe onboarding URL."));
                    },
                    error: reject,
                });
        });
    }

    openDashboard(): void {
        this.http
            .post<StripeConnectResponse>(`${this.baseUrl}/connect/dashboard-link`, {})
            .subscribe({
                next: (res) => {
                    if (res?.url) {
                        window.location.href = res.url;
                    }
                },
                error: () => {
                    throw new Error("Unable to open Stripe dashboard.");
                },
            });
    }

    disconnect(): Observable<StripeDisconnectResponse> {
        return this.http.delete<StripeDisconnectResponse>(this.baseUrl);
    }
}