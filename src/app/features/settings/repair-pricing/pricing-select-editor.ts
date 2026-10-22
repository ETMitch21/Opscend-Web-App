import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type EditorType } from '@revolist/angular-datagrid';
import { PricingGridLookups } from './pricing-grid-lookups';

/** Searchable, keyboard-accessible editor for enumerated RevoGrid cells. */
@Component({
  selector: 'app-pricing-select-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <input #searchInput type="text" autocomplete="off" role="combobox"
      aria-label="Search choices" aria-autocomplete="list" [attr.aria-expanded]="true"
      class="w-full h-full bg-white border border-orange-400 rounded-sm px-2 text-xs outline-none"
      [ngModel]="query()" (ngModelChange)="search($event)"
      (keydown)="onKey($event)" (focus)="placeMenu()" />
    <div class="fixed z-[9999] overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl py-1"
      role="listbox" [style.left.px]="left()" [style.top.px]="top()"
      [style.width.px]="width()" style="max-height:270px; min-width:190px;">
      <div *ngIf="loading()" class="px-3 py-2 text-xs text-gray-500">Searching devices…</div>
      <div *ngIf="!loading() && !results().length" class="px-3 py-2 text-xs text-gray-500">No matches</div>
      <button *ngIf="canCreate()" type="button" class="w-full text-left px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 border-t border-gray-100"
        (mousedown)="$event.preventDefault()" (click)="createChoice()">+ Create “{{ query().trim() }}”</button>
      <button *ngFor="let item of results(); let i = index" type="button" role="option"
        [attr.aria-selected]="i === active()"
        class="block w-full text-left px-3 py-2 text-xs truncate hover:bg-orange-50"
        [class.bg-orange-100]="i === active()"
        (mousedown)="$event.preventDefault()" (click)="choose(item)">{{ item }}</button>
    </div>
  `,
})
export class PricingSelectEditorComponent implements OnInit, OnDestroy {
  @Input() props!: EditorType;
  private readonly lookups = inject(PricingGridLookups);
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly query = signal('');
  readonly results = signal<string[]>([]);
  readonly loading = signal(false);
  readonly active = signal(0);
  readonly left = signal(0);
  readonly top = signal(0);
  readonly width = signal(220);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private readonly placeHandler = () => this.placeMenu();

  get field(): string { return String(this.props.column?.prop ?? ''); }

  ngOnInit(): void {
    this.query.set(String(this.props.val ?? ''));
    this.search(this.query());
    window.addEventListener('resize', this.placeHandler);
    window.addEventListener('scroll', this.placeHandler, true);
    queueMicrotask(() => {
      this.placeMenu();
      this.element.nativeElement.querySelector('input')?.focus();
      this.element.nativeElement.querySelector('input')?.select();
    });
  }
  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.requestId++;
    window.removeEventListener('resize', this.placeHandler);
    window.removeEventListener('scroll', this.placeHandler, true);
  }
  placeMenu(): void {
    const bounds = this.element.nativeElement.getBoundingClientRect();
    this.left.set(Math.max(4, bounds.left));
    this.top.set(bounds.bottom + 2);
    this.width.set(Math.max(190, bounds.width));
  }
  search(input: string): void {
    this.query.set(input);
    this.active.set(0);
    if (this.timer) clearTimeout(this.timer);
    const needle = input.trim().toLowerCase();
    if (this.field !== 'device') {
      this.results.set((this.lookups.values()[this.field] ?? []).filter(x => x.toLowerCase().includes(needle)));
      return;
    }
    const serial = ++this.requestId;
    // Find device names as the user types, without requiring the whole catalog in memory.
    this.loading.set(true);
    this.timer = setTimeout(async () => {
      try {
        const rows = await this.lookups.searchDevices(input);
        if (serial === this.requestId) this.results.set(rows);
      } catch {
        if (serial === this.requestId) this.results.set([]);
      } finally {
        if (serial === this.requestId) this.loading.set(false);
      }
    }, 180);
  }
  canCreate(): boolean {
    const value = this.query().trim();
    return (this.field === 'repair' || this.field === 'variant') && !!value &&
      !(this.lookups.values()[this.field] || []).some(x => x.trim().toLocaleLowerCase() === value.toLocaleLowerCase());
  }
  createChoice(): void { if (this.canCreate()) this.props.save('__create__:' + this.query().trim()); }
  choose(value: string): void { this.props.save(value); }
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.props.close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      const count = this.results().length;
      if (count) this.active.set((this.active() + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      const selected = this.results()[this.active()];
      if (selected) this.choose(selected); else if (this.canCreate()) this.createChoice();
      return;
    }
    // Let Tab commit/close through RevoGrid's native focus handling.
    if (event.key !== 'Tab') event.stopPropagation();
  }
}
