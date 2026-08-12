import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  ArchiveIcon,
  DatabaseIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  ShieldCheckIcon,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import {
  DataExportSection,
  DataExportService,
} from '../../../core/data-export/data-export.service';
import { ToastService } from '../../../core/toast/toast-service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

@Component({
  selector: 'app-data-export',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SettingsLayoutComponent],
  templateUrl: './data-export.html',
})
export class DataExportSettings implements OnInit {
  private readonly exportApi = inject(DataExportService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Archive: ArchiveIcon,
    Database: DatabaseIcon,
    Download: DownloadIcon,
    File: FileSpreadsheetIcon,
    Loader: LoaderCircleIcon,
    Shield: ShieldCheckIcon,
  };

  readonly loading = signal(true);
  readonly fullExporting = signal(false);
  readonly exportingSection = signal<string | null>(null);
  readonly sections = signal<DataExportSection[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const response = await firstValueFrom(this.exportApi.listSections());
      this.sections.set(response.data ?? []);
    } catch (error) {
      console.error('Unable to load data export sections.', error);
      this.toast.error('Data exports could not be loaded');
    } finally {
      this.loading.set(false);
    }
  }

  async exportAll(): Promise<void> {
    if (this.fullExporting()) return;
    this.fullExporting.set(true);
    try {
      const response = await firstValueFrom(this.exportApi.downloadFull());
      this.saveResponse(response, `opscend-data-${this.today()}.zip`);
      this.toast.success('Full data export downloaded');
    } catch (error) {
      console.error('Full data export failed.', error);
      this.toast.error('Full data export failed');
    } finally {
      this.fullExporting.set(false);
    }
  }

  async exportSection(section: DataExportSection): Promise<void> {
    if (this.exportingSection()) return;
    this.exportingSection.set(section.key);
    try {
      const response = await firstValueFrom(this.exportApi.downloadSection(section.key));
      this.saveResponse(response, section.fileName);
    } catch (error) {
      console.error(`Data export failed for ${section.key}.`, error);
      this.toast.error(`${section.label} export failed`);
    } finally {
      this.exportingSection.set(null);
    }
  }

  private saveResponse(response: { body: Blob | null; headers: { get(name: string): string | null } }, fallbackName: string): void {
    if (!response.body) throw new Error('empty_export');
    const disposition = response.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || fallbackName;
    const url = URL.createObjectURL(response.body);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
