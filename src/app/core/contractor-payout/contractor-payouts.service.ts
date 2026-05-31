import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';
import {
  ContractorPayout,
  ContractorPayoutListQuery,
  UpdateContractorPayoutStatusRequest,
} from './contractor-payout.model';

@Injectable({
  providedIn: 'root',
})
export class ContractorPayoutsService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.apiBase}/contractor-payouts`;

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  list(query?: ContractorPayoutListQuery): Observable<ContractorPayout[]> {
    let params = new HttpParams();

    if (query?.status && query.status !== 'all') {
      params = params.set('status', query.status);
    }

    return this.http.get<ContractorPayout[]>(this.baseUrl, { params });
  }

  updateStatus(
    payoutId: string,
    payload: UpdateContractorPayoutStatusRequest
  ): Observable<ContractorPayout> {
    return this.http.patch<ContractorPayout>(
      `${this.baseUrl}/${payoutId}/status`,
      payload
    );
  }
}
