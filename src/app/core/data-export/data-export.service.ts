import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../app-config/app-config.service';

export interface DataExportSection {
  key: string;
  label: string;
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class DataExportService {
  private readonly config = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.config.config.apiBase}/data-export`;
  }

  listSections(): Observable<{ data: DataExportSection[] }> {
    return this.http.get<{ data: DataExportSection[] }>(`${this.baseUrl}/sections`);
  }

  downloadSection(key: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(key)}.csv`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  downloadFull(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/full.zip`, {
      observe: 'response',
      responseType: 'blob',
    });
  }
}
