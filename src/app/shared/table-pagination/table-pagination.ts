import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LucideAngularModule,
} from 'lucide-angular';
import { TablePaginationStateService } from './table-pagination-state.service';

@Component({
  selector: 'app-table-pagination',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (totalItems > 0) {
      <div class="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div class="text-sm text-gray-500">
          Showing
          <span class="font-medium text-gray-700">{{ rangeStart }}</span>–<span class="font-medium text-gray-700">{{ rangeEnd }}</span>
          of <span class="font-medium text-gray-700">{{ totalItems }}</span>
          {{ totalItems === 1 ? singularLabel : pluralLabel }}
        </div>

        <div class="flex items-center justify-between gap-2 sm:justify-end">
          <span class="mr-1 whitespace-nowrap text-sm text-gray-500">
            Page <span class="font-medium text-gray-700">{{ page }}</span> of
            <span class="font-medium text-gray-700">{{ totalPages }}</span>
          </span>

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
            [disabled]="page <= 1"
            (click)="goToPage(1)"
            aria-label="First page"
            title="First page"
          >
            <lucide-icon [name]="firstIcon" [size]="16"></lucide-icon>
          </button>

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
            [disabled]="page <= 1"
            (click)="goToPage(page - 1)"
            aria-label="Previous page"
            title="Previous page"
          >
            <lucide-icon [name]="previousIcon" [size]="16"></lucide-icon>
          </button>

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
            [disabled]="(page >= totalPages && !hasMore) || loadingMore"
            (click)="nextPage()"
            aria-label="Next page"
            title="Next page"
          >
            @if (loadingMore && page >= totalPages) {
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700"></span>
            } @else {
              <lucide-icon [name]="nextIcon" [size]="16"></lucide-icon>
            }
          </button>

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
            [disabled]="page >= totalPages"
            (click)="goToPage(totalPages)"
            aria-label="Last page"
            title="Last page"
          >
            <lucide-icon [name]="lastIcon" [size]="16"></lucide-icon>
          </button>
        </div>
      </div>
    }
  `,
})
export class TablePagination implements OnChanges {
  private readonly pagination = inject(TablePaginationStateService);

  @Input({ required: true }) storageKey = '';
  @Input() totalItems = 0;
  @Input() defaultPageSize = 25;
  @Input() pageSizeOptions: number[] = [10, 25, 50, 100];
  @Input() singularLabel = 'record';
  @Input() pluralLabel = 'records';
  @Input() hasMore = false;
  @Input() loadingMore = false;
  @Output() loadMoreRequested = new EventEmitter<void>();

  private pendingFromPage: number | null = null;
  private pendingLoadedCount = 0;

  readonly firstIcon = ChevronsLeft;
  readonly previousIcon = ChevronLeft;
  readonly nextIcon = ChevronRight;
  readonly lastIcon = ChevronsRight;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['totalItems'] || changes['storageKey']) && this.storageKey) {
      this.pagination.clamp(this.storageKey, this.totalItems, this.defaultPageSize);
    }

    if (this.pendingFromPage !== null) {
      if (this.totalPages > this.pendingFromPage) {
        const targetPage = this.pendingFromPage + 1;
        this.pendingFromPage = null;
        this.pagination.setPage(this.storageKey, targetPage, this.totalItems, this.defaultPageSize);
      } else if (changes['loadingMore'] && !this.loadingMore) {
        if (this.hasMore && this.totalItems > this.pendingLoadedCount) {
          this.pendingLoadedCount = this.totalItems;
          this.loadMoreRequested.emit();
        } else {
          this.pendingFromPage = null;
        }
      }
    }
  }

  get page(): number {
    return Math.min(
      this.pagination.page(this.storageKey, this.defaultPageSize),
      this.totalPages,
    );
  }

  get pageSize(): number {
    return this.pagination.pageSize(this.storageKey, this.defaultPageSize);
  }

  get totalPages(): number {
    return this.pagination.totalPages(this.storageKey, this.totalItems, this.defaultPageSize);
  }

  get rangeStart(): number {
    return this.pagination.rangeStart(this.storageKey, this.totalItems, this.defaultPageSize);
  }

  get rangeEnd(): number {
    return this.pagination.rangeEnd(this.storageKey, this.totalItems, this.defaultPageSize);
  }

  goToPage(page: number): void {
    this.pagination.setPage(this.storageKey, page, this.totalItems, this.defaultPageSize);
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.goToPage(this.page + 1);
      return;
    }

    if (!this.hasMore || this.loadingMore) return;

    this.pendingFromPage = this.page;
    this.pendingLoadedCount = this.totalItems;
    this.loadMoreRequested.emit();
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
