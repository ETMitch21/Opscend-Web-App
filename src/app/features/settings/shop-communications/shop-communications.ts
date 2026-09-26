import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/app-config/app-config.service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

interface ShopResponse { id: string; settings: { communications: { smsEnabled: boolean; twilioPhoneNumber: string | null } } }

@Component({ selector: 'app-shop-communications-settings', standalone: true, imports: [CommonModule, FormsModule, RouterModule, SettingsLayoutComponent], templateUrl: './shop-communications.html' })
export class ShopCommunicationsSettings implements OnInit {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  readonly loading = signal(true); readonly saving = signal(false); readonly error = signal<string | null>(null); readonly success = signal<string | null>(null); readonly shopId = signal<string | null>(null);
  smsEnabled = false; twilioPhoneNumber = '';
  private get apiBase(): string { return this.appConfig.config.apiBase; }
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(null); try { const res = await firstValueFrom(this.http.get<{data: ShopResponse[]}>(`${this.apiBase}/shops`)); const shop=res.data?.[0]; if(!shop) throw new Error('shop_not_found'); this.shopId.set(shop.id); this.smsEnabled=!!shop.settings?.communications?.smsEnabled; this.twilioPhoneNumber=shop.settings?.communications?.twilioPhoneNumber ?? ''; } catch(e){ console.error(e); this.error.set('Communication settings could not be loaded.'); } finally { this.loading.set(false); } }
  async save(): Promise<void> { const shopId=this.shopId(); if(!shopId) return; const phone=this.twilioPhoneNumber.trim(); if(this.smsEnabled && !/^\+\d{10,15}$/.test(phone)){ this.error.set('Twilio SMS number must be in E.164 format, like +18165551234.'); return; } this.saving.set(true); this.error.set(null); this.success.set(null); try { await firstValueFrom(this.http.patch(`${this.apiBase}/shops/${shopId}`, {settings:{communications:{smsEnabled:this.smsEnabled,twilioPhoneNumber:phone||null}}})); this.success.set('Communication settings updated.'); await this.load(); } catch(e){ console.error(e); this.error.set('Communication settings could not be saved.'); } finally { this.saving.set(false); } }
}
