import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SearchItemType = 'customer' | 'repair' | 'appointment';

export type SearchItem = {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string | null;
  route: string;
};

export type GlobalSearchResponse = {
  customers: SearchItem[];
  repairs: SearchItem[];
  appointments: SearchItem[];
};

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private http = inject(HttpClient);

  search(query: string, limit = 5): Observable<GlobalSearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', String(limit));

    return this.http.get<GlobalSearchResponse>(`${environment.apiBase}/search`, { params });
  }
}