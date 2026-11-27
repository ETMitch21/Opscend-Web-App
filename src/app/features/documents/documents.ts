import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SettingsLayoutComponent } from '../settings/settings-layout/settings-layout';
import { DocumentsService, type DocumentSettings, type SavedDocumentRow, type ScheduledReport, type ScheduledReportJob, type AutomaticReceiptRow } from '../../core/documents/documents.service';

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SettingsLayoutComponent],
  templateUrl: './documents.html',
})
export class DocumentsPage implements OnInit {
  private readonly documents = inject(DocumentsService);
  readonly settingsPage = inject(ActivatedRoute).snapshot.data['documentSettingsMode'] === true;
  readonly showSettings = signal(false);
  readonly settingsBusy = signal(false);
  readonly settingsMessage = signal('');
  readonly settingsError = signal(false);
  readonly scheduleError = signal(false);
  settings: DocumentSettings | null = null;
  readonly automaticReceipts = signal<AutomaticReceiptRow[]>([]);
  readonly utcHours = Array.from({ length: 24 }, (_, i) => i);
  readonly scheduleBusy = signal(false);
  readonly scheduleMessage = signal('');
  readonly reportJobs = signal<ScheduledReportJob[]>([]);
  reportSchedules: ScheduledReport[] = [
    { id: '', kind: 'sales', frequency: 'daily', hourUtc: 8, recipientEmail: '', enabled: false, nextRunAt: null },
    { id: '', kind: 'inventory', frequency: 'weekly', hourUtc: 8, recipientEmail: '', enabled: false, nextRunAt: null },
  ];

  async loadReportSchedules(): Promise<void> {
    try {
      this.scheduleError.set(false);
      const result = await this.documents.scheduledReports();
      for (const saved of result.schedules) {
        const index = this.reportSchedules.findIndex(s => s.kind === saved.kind);
        if (index >= 0) this.reportSchedules[index] = saved;
      }
      this.reportJobs.set(result.jobs);
    } catch { this.scheduleError.set(true); this.scheduleMessage.set('Unable to load scheduled reports.'); }
  }

  async saveReportSchedule(row: ScheduledReport): Promise<void> {
    this.scheduleBusy.set(true); this.scheduleMessage.set(''); this.scheduleError.set(false);
    try {
      await this.documents.saveReportSchedule(row.kind, {
        enabled: row.enabled, frequency: row.frequency, hourUtc: Number(row.hourUtc), recipientEmail: row.recipientEmail.trim(),
      });
      await this.loadReportSchedules();
      this.scheduleMessage.set('Report schedule updated. Times are in UTC.');
    } catch { this.scheduleError.set(true); this.scheduleMessage.set('Unable to save schedule. Check the email, hour, and permissions.'); }
    finally { this.scheduleBusy.set(false); }
  }

  readonly rows = signal<SavedDocumentRow[]>([]);
  readonly loading = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly error = signal('');
  readonly cursor = signal<string | null>(null);
  readonly kind = signal('');
  search = '';
  dateFrom = '';
  dateTo = '';
  readonly types = [
    { value: '', label: 'All documents' },
    { value: 'ticket', label: 'Repair tickets' },
    { value: 'receipt', label: 'Receipts' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'quote', label: 'Quotes' },
    { value: 'work-order', label: 'Work orders' },
    { value: 'sales', label: 'Sales reports' },
    { value: 'inventory', label: 'Inventory reports' },
  ];

  ngOnInit(): void { if (this.settingsPage) void this.toggleSettings(); else void this.refresh(); }

  async toggleSettings(): Promise<void> {
    if (this.showSettings()) { this.showSettings.set(false); return; }
    this.settingsBusy.set(true); this.settingsMessage.set(''); this.settingsError.set(false);
    try {
      this.settings = await this.documents.getSettings();
      this.automaticReceipts.set(await this.documents.automaticReceipts());
      await this.loadReportSchedules();
      this.showSettings.set(true);
    }
    catch { this.settingsError.set(true); this.settingsMessage.set('Unable to load document settings.'); }
    finally { this.settingsBusy.set(false); }
  }

  onAutoReceiptChange(): void {
    if (this.settings && !this.settings.autoReceiptEnabled) this.settings.autoReceiptEmailEnabled = false;
  }

  async saveSettings(): Promise<void> {
    if (!this.settings) return;
    this.settingsBusy.set(true); this.settingsMessage.set(''); this.settingsError.set(false);
    try {
      this.settings.labelCopies = Math.max(1, Math.min(10, Math.round(Number(this.settings.labelCopies) || 1)));
      const { hasLogo: _hasLogo, ...values } = this.settings;
      await this.documents.updateSettings(values);
      this.settingsMessage.set('Document settings saved. New PDFs will use these preferences.');
    } catch { this.settingsError.set(true); this.settingsMessage.set('Unable to save settings. Check your shop permissions.'); }
    finally { this.settingsBusy.set(false); }
  }

  async onLogoChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.settingsBusy.set(true); this.settingsMessage.set(''); this.settingsError.set(false);
    try { await this.documents.uploadLogo(file); if (this.settings) this.settings.hasLogo = true; this.settingsMessage.set('Logo uploaded.'); }
    catch (error) { this.settingsError.set(true); this.settingsMessage.set(error instanceof Error ? error.message : 'Logo upload failed.'); }
    finally { this.settingsBusy.set(false); (event.target as HTMLInputElement).value = ''; }
  }

  async removeLogo(): Promise<void> {
    this.settingsBusy.set(true);
    try { await this.documents.removeLogo(); if (this.settings) this.settings.hasLogo = false; this.settingsMessage.set('Logo removed from future documents.'); }
    catch { this.settingsError.set(true); this.settingsMessage.set('Unable to remove logo.'); }
    finally { this.settingsBusy.set(false); }
  }


  async selectKind(value: string): Promise<void> {
    this.kind.set(value);
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.rows.set([]);
    this.cursor.set(null);
    await this.loadMore();
  }

  async loadMore(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.documents.listArchive(this.kind() || undefined, this.cursor() || undefined, { q: this.search, from: this.dateFrom, to: this.dateTo });
      this.rows.update(rows => [...rows, ...result.data]);
      this.cursor.set(result.nextCursor);
    } catch {
      this.error.set('Unable to load documents. Check your permissions and try again.');
    } finally { this.loading.set(false); }
  }

  async preview(row: SavedDocumentRow): Promise<void> { await this.documents.previewSaved(row); }

  async download(row: SavedDocumentRow): Promise<void> {
    this.busyId.set(row.id);
    this.error.set('');
    try { await this.documents.downloadSaved(row); }
    catch { this.error.set('Unable to download the saved PDF.'); }
    finally { this.busyId.set(null); }
  }
}
