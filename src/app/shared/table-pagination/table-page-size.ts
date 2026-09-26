import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { TablePaginationStateService } from './table-pagination-state.service';

@Component({
  selector: 'app-table-page-size',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="inline-flex items-center gap-2 whitespace-nowrap text-sm text-gray-500">
      <span>Rows</span>
      <select
        class="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none transition hover:bg-gray-50 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        [value]="pageSize"
        (change)="changePageSize($any($event.target).value)"
        aria-label="Rows per page"
      >
        @for (option of pageSizeOptions; track option) {
          <option [value]="option">{{ option }}</option>
        }
      </select>
    </label>
  `,
})
export class TablePageSize {
  private readonly pagination = inject(TablePaginationStateService);

  @Input({ required: true }) storageKey = '';
  @Input() totalItems = 0;
  @Input() defaultPageSize = 25;
  @Input() pageSizeOptions: number[] = [10, 25, 50, 100];

  get pageSize(): number {
    return this.pagination.pageSize(this.storageKey, this.defaultPageSize);
  }

  changePageSize(rawValue: string | number): void {
    this.pagination.setPageSize(
      this.storageKey,
      Number(rawValue),
      this.totalItems,
      this.defaultPageSize,
    );
  }
}
