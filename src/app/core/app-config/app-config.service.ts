import { Injectable, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiBase: string;
  mobilesentrixUrl: string;
  mobilesentrixConsumerName: string;
  mobilesentrixConsumerKey: string;
  mobilesentrixConsumerSecret: string;
  stripePublishableKey: string;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly _config = signal<AppConfig | null>(null);
  private readonly http: HttpClient;

  constructor(httpBackend: HttpBackend) {
    this.http = new HttpClient(httpBackend);
  }

  async load(): Promise<void> {
    const config = await firstValueFrom(
      this.http.get<AppConfig>('/config.json')
    );
    this._config.set(config);
  }

  get config(): AppConfig {
    const value = this._config();
    if (!value) {
      throw new Error('App config has not been loaded yet.');
    }
    return value;
  }
}