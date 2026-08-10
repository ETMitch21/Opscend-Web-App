import { CommonModule } from '@angular/common';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  CheckIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  SearchIcon,
  XIcon,
} from 'lucide-angular';

export interface TypeaheadItem {
  id: string;
  label: string;
  description?: string | null;
  meta?: string | null;
  disabled?: boolean;
}

let nextTypeaheadId = 0;

@Component({
  selector: 'app-typeahead',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, OverlayModule],
  templateUrl: './typeahead.html',
  styleUrl: './typeahead.scss',
})
export class TypeaheadComponent implements OnChanges {
  @Input() items: TypeaheadItem[] = [];
  @Input() selectedItem: TypeaheadItem | null = null;
  @Input() placeholder = 'Search…';
  @Input() emptyText = 'No matches found.';
  @Input() loading = false;
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() minimumQueryLength = 0;
  @Input() hint = '';
  /**
   * Set to false when `items` already come from a server-side search.
   * Re-filtering remote results locally can hide valid matches returned for
   * fields that are not rendered in the option label (for example supplier SKU).
   */
  @Input() filterLocally = true;

  @Output() searchChange = new EventEmitter<string>();
  @Output() selectedItemChange = new EventEmitter<TypeaheadItem | null>();

  readonly inputId = `app-typeahead-${++nextTypeaheadId}`;
  readonly listboxId = `${this.inputId}-listbox`;
  readonly icons = {
    Check: CheckIcon,
    Loader: LoaderCircleIcon,
    Search: SearchIcon,
    X: XIcon,
  };

  readonly overlayPositions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 6,
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -6,
    },
  ];

  query = '';
  open = false;
  activeIndex = -1;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  get visibleItems(): TypeaheadItem[] {
    if (!this.filterLocally) return this.items;

    const query = this.normalize(this.query);
    if (!query || this.selectedItem?.label === this.query) return this.items;

    return this.items.filter((item) =>
      this.normalize(`${item.label} ${item.description ?? ''} ${item.meta ?? ''}`).includes(query),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedItem']) {
      const next = this.selectedItem?.label ?? '';
      if (!this.open || !this.query || this.query === changes['selectedItem'].previousValue?.label) {
        this.query = next;
      }
    }

    if (changes['items'] && this.activeIndex >= this.visibleItems.length) {
      this.activeIndex = this.firstEnabledIndex();
    }
  }

  onFocus(): void {
    if (this.disabled) return;
    this.cancelBlur();
    this.open = true;
    this.activeIndex = this.firstEnabledIndex();
    this.searchChange.emit(this.selectedItem ? '' : this.query);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query = value;
    this.open = true;
    this.activeIndex = this.firstEnabledIndex();

    if (this.selectedItem && value !== this.selectedItem.label) {
      this.selectedItemChange.emit(null);
    }

    this.searchChange.emit(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open = true;
      this.moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.open = true;
      this.moveActive(-1);
      return;
    }

    if (event.key === 'Enter' && this.open && this.activeIndex >= 0) {
      event.preventDefault();
      const item = this.visibleItems[this.activeIndex];
      if (item && !item.disabled) this.select(item);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.query = this.selectedItem?.label ?? '';
    }
  }

  select(item: TypeaheadItem): void {
    if (item.disabled) return;
    this.cancelBlur();
    this.query = item.label;
    this.selectedItemChange.emit(item);
    this.close();
  }

  clear(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;
    this.query = '';
    this.selectedItemChange.emit(null);
    this.searchChange.emit('');
    this.open = true;
    this.activeIndex = this.firstEnabledIndex();
  }

  scheduleClose(): void {
    this.cancelBlur();
    this.blurTimer = setTimeout(() => this.close(), 140);
  }

  cancelBlur(): void {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
  }

  trackById(_: number, item: TypeaheadItem): string {
    return item.id;
  }

  private close(): void {
    this.open = false;
    this.activeIndex = -1;
  }

  private firstEnabledIndex(): number {
    return this.visibleItems.findIndex((item) => !item.disabled);
  }

  private moveActive(direction: 1 | -1): void {
    const items = this.visibleItems;
    if (!items.length) {
      this.activeIndex = -1;
      return;
    }

    let index = this.activeIndex;
    for (let attempt = 0; attempt < items.length; attempt += 1) {
      index = (index + direction + items.length) % items.length;
      if (!items[index]?.disabled) {
        this.activeIndex = index;
        return;
      }
    }
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ');
  }
}
