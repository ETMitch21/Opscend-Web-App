import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Link2, Plus, RefreshCw, Search, CircleCheck, Ban, Copy, ExternalLink, Loader2, CreditCard, X, Trash2, LucideAngularModule } from 'lucide-angular';
import { TablePagination } from '../../shared/table-pagination/table-pagination';
import { TablePageSize } from '../../shared/table-pagination/table-page-size';
import { TablePaginationStateService } from '../../shared/table-pagination/table-pagination-state.service';
import { AppConfigService } from '../../core/app-config/app-config.service';

type Item = { name: string; price: number | null; quantity: number };
type PaymentLink = { id: string; url: string; active: boolean; created: number; paidCount: number; items: { name: string; quantity: number; unitAmountCents: number }[] };
@Component({ selector: 'app-payment-links', standalone: true, imports: [CommonModule, FormsModule, LucideAngularModule, TablePagination, TablePageSize], templateUrl: './payment-links.html', styleUrl: './payment-links.css' })
export class PaymentLinks implements OnInit {
  readonly icons = { Link2, Plus, RefreshCw, Search, CircleCheck, Ban, Copy, ExternalLink, Loader2, CreditCard, X, Trash2 };
  readonly tablePagination = inject(TablePaginationStateService);
  readonly search = signal('');
  readonly filter = signal<'all' | 'active' | 'used'>('all');
  readonly filteredLinks = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.links().filter(link => {
      const status = this.linkStatus(link);
      // Deactivated, unpaid links are archived from the operational list.
      if (status === 'inactive') return false;
      if (this.filter() !== 'all' && status !== this.filter()) return false;
      return !q || [link.id, link.url, ...link.items.map(item => item.name)].join(' ').toLowerCase().includes(q);
    });
  });
  readonly activeCount = computed(() => this.links().filter(l => this.linkStatus(l) === 'active').length);
  readonly usedCount = computed(() => this.links().filter(l => this.linkStatus(l) === 'used').length);
  readonly visibleCount = computed(() => this.links().filter(l => this.linkStatus(l) !== 'inactive').length);
  readonly activeValueCents = computed(() => this.links().filter(l => this.linkStatus(l) === 'active').reduce((sum, link) => sum + this.linkTotalCents(link), 0));
  linkStatus(link: PaymentLink): 'active' | 'used' | 'inactive' { return link.paidCount > 0 ? 'used' : link.active ? 'active' : 'inactive'; }
  linkTotalCents(link: PaymentLink): number { return link.items.reduce((sum, i) => sum + (i.unitAmountCents || 0) * (i.quantity || 0), 0); }
  linkItemSummary(link: PaymentLink): string { return link.items.length ? link.items.map(i => `${i.name}${i.quantity > 1 ? ' × ' + i.quantity : ''}`).join(', ') : 'Stripe payment link'; }
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly links = signal<PaymentLink[]>([]);
  showCreate = false;
  items: Item[] = [{ name: '', price: null, quantity: 1 }];
  private get endpoint() { return `${this.config.config.apiBase}/payment-links`; }
  ngOnInit() { void this.load(); }
  async load() {
    this.loading.set(true); this.error.set(null);
    try { const result = await firstValueFrom(this.http.get<{ data: PaymentLink[] }>(this.endpoint)); this.links.set(result.data); }
    catch { this.error.set('Unable to load payment links.'); }
    finally { this.loading.set(false); }
  }
  get total() { return this.items.reduce((sum, item) => sum + Math.round(Number(item.price || 0) * 100) * Number(item.quantity || 0), 0) / 100; }
  addItem() { this.items.push({ name: '', price: null, quantity: 1 }); }
  removeItem(index: number) { if (this.items.length > 1) this.items.splice(index, 1); }
  async create() {
    const valid = this.items.every(i => i.name.trim() && Number.isFinite(Number(i.price)) && Number(i.price) >= .5 && Number.isInteger(Number(i.quantity)) && Number(i.quantity) > 0);
    if (!valid) { this.error.set('Enter a name, valid price (at least $0.50), and quantity for each item.'); return; }
    this.saving.set(true); this.error.set(null);
    try {
      const payload = { items: this.items.map(i => ({ name: i.name.trim(), unitAmountCents: Math.round(Number(i.price) * 100), quantity: Number(i.quantity) })) };
      const result = await firstValueFrom(this.http.post<{ data: PaymentLink }>(this.endpoint, payload));
      this.links.update(existing => [result.data, ...existing]); this.showCreate = false; this.items = [{ name: '', price: null, quantity: 1 }];
      await this.copy(result.data.url);
    } catch { this.error.set('Could not create the payment link. Check that your Stripe account can accept payments.'); }
    finally { this.saving.set(false); }
  }
  async deactivate(link: PaymentLink) {
    if (!confirm('Deactivate this payment link? Customers will no longer be able to pay using it.')) return;
    try { const result = await firstValueFrom(this.http.post<{ data: PaymentLink }>(`${this.endpoint}/${link.id}/deactivate`, {})); this.links.update(list => list.map(l => l.id === link.id ? result.data : l)); }
    catch { this.error.set('Could not deactivate the payment link.'); }
  }
  async copy(url: string) { try { await navigator.clipboard.writeText(url); } catch { this.error.set('Link created. Copy its URL manually.'); } }
  money(cents: number) { return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
}
