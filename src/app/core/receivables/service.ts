import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../app-config/app-config.service';
import type { ReceivablesResponse } from './model';

@Injectable({ providedIn: 'root' })
export class ReceivablesService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  load(): Observable<ReceivablesResponse> {
    return this.http.get<ReceivablesResponse>(
      `${this.appConfig.config.apiBase}/receivables`,
    );
  }
}
