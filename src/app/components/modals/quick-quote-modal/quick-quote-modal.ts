import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  BadgeCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleHelpIcon,
  DollarSignIcon,
  LoaderCircleIcon,
  LucideAngularModule,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-angular';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  of,
  switchMap,
} from 'rxjs';

import {
  TypeaheadComponent,
  TypeaheadItem,
} from '../../../core/ui/typeahead/typeahead';
import {
  ManagedDeviceCatalogModel,
  TechSpecsService,
} from '../../../core/techspecs/techspecs.service';
import { RepairType } from '../../../core/repair-pricing/model';
import { RepairPricingService } from '../../../core/repair-pricing/service';
import {
  QuickQuoteCandidate,
  QuickQuotePreview,
  QuickQuoteSettings,
} from '../../../core/quick-quote/model';
import { QuickQuoteService } from '../../../core/quick-quote/service';
import { ToastService } from '../../../core/toast/toast-service';

@Component({
  selector: 'app-quick-quote-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TypeaheadComponent],
  templateUrl: './quick-quote-modal.html',
})
export class QuickQuoteModalComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  private readonly router = inject(Router);
  private readonly catalogApi = inject(TechSpecsService);
  private readonly pricingApi = inject(RepairPricingService);
  private readonly quickQuoteApi = inject(QuickQuoteService);
  private readonly toast = inject(ToastService);

  readonly icons = {
    Approved: BadgeCheckIcon,
    Check: CheckIcon,
    Help: CircleHelpIcon,
    Alert: CircleAlertIcon,
    Dollar: DollarSignIcon,
    Loader: LoaderCircleIcon,
    Refresh: RefreshCwIcon,
    Search: SearchIcon,
    Sparkles: SparklesIcon,
    Wrench: WrenchIcon,
    X: XIcon,
  };

  readonly loadingBootstrap = signal(false);
  readonly modelLoading = signal(false);
  readonly quoteLoading = signal(false);
  readonly remembering = signal(false);
  readonly settings = signal<QuickQuoteSettings | null>(null);
  readonly models = signal<ManagedDeviceCatalogModel[]>([]);
  readonly repairTypes = signal<RepairType[]>([]);
  readonly selectedModel = signal<ManagedDeviceCatalogModel | null>(null);
  readonly selectedRepairType = signal<RepairType | null>(null);
  readonly result = signal<QuickQuotePreview | null>(null);

  readonly canQuote = computed(
    () => Boolean(this.selectedModel() && this.selectedRepairType()) && !this.quoteLoading(),
  );

  readonly modelItems = computed<TypeaheadItem[]>(() =>
    this.models().map((model) => ({
      id: model.id,
      label: model.name,
      description: `${model.brandName} · ${model.categoryName}`,
      meta: model.releaseYear ? String(model.releaseYear) : null,
    })),
  );

  readonly selectedModelItem = computed<TypeaheadItem | null>(() => {
    const model = this.selectedModel();
    return model
      ? {
          id: model.id,
          label: model.name,
          description: `${model.brandName} · ${model.categoryName}`,
          meta: model.releaseYear ? String(model.releaseYear) : null,
        }
      : null;
  });

  readonly repairTypeItems = computed<TypeaheadItem[]>(() =>
    this.repairTypes().map((type) => ({
      id: type.id,
      label: type.label,
      description: type.description || type.code,
      meta: type.supplierPreferredTerms?.length
        ? `Prefers ${type.supplierPreferredTerms.join(', ')}`
        : null,
    })),
  );

  readonly selectedRepairTypeItem = computed<TypeaheadItem | null>(() => {
    const type = this.selectedRepairType();
    return type
      ? {
          id: type.id,
          label: type.label,
          description: type.description || type.code,
        }
      : null;
  });

  private readonly modelSearch$ = new Subject<string>();
  private readonly subscription = new Subscription();
  private modelSearchVersion = 0;
  private loaded = false;

  ngOnInit(): void {
    this.subscription.add(
      this.modelSearch$
        .pipe(
          debounceTime(220),
          distinctUntilChanged(),
          switchMap((rawQuery) => {
            const query = rawQuery.trim();
            const requestVersion = ++this.modelSearchVersion;

            if (query.length < 2) {
              this.models.set([]);
              this.modelLoading.set(false);
              return of(null);
            }

            this.modelLoading.set(true);
            return this.catalogApi
              .searchManagedModels({
                includeInactive: false,
                search: query,
                limit: 30,
              })
              .pipe(
                catchError((error) => {
                  console.error('Unable to search Quick Quote device models', error);
                  return of(null);
                }),
                finalize(() => {
                  if (requestVersion === this.modelSearchVersion) {
                    this.modelLoading.set(false);
                  }
                }),
              );
          }),
        )
        .subscribe((response) => {
          if (!response) return;
          const selected = this.selectedModel();
          const rows = response.data ?? [];
          this.models.set(
            selected && !rows.some((row) => row.id === selected.id)
              ? [selected, ...rows]
              : rows,
          );
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.modelSearch$.complete();
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded || this.loadingBootstrap()) return;
    this.loadingBootstrap.set(true);
    try {
      const [settings, repairTypes] = await Promise.all([
        firstValueFrom(this.quickQuoteApi.getSettings()),
        firstValueFrom(this.pricingApi.listRepairTypes()),
      ]);
      this.settings.set(settings);
      this.repairTypes.set(
        (repairTypes.data ?? [])
          .filter((type) => type.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
      );
      this.loaded = true;
      this.models.set([]);
    } catch (error) {
      console.error(error);
      this.toast.error('Quick Quote could not be loaded');
    } finally {
      this.loadingBootstrap.set(false);
    }
  }

  onBackdrop(): void {
    if (!this.quoteLoading() && !this.remembering()) this.close();
  }

  close(): void {
    this.closed.emit();
  }

  onModelSearch(value: string): void {
    this.modelSearch$.next(value);
  }

  onModelSelected(item: TypeaheadItem | null): void {
    const model = item
      ? this.models().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedModel.set(model);
    this.result.set(null);
  }

  onRepairTypeSelected(item: TypeaheadItem | null): void {
    const type = item
      ? this.repairTypes().find((row) => row.id === item.id) ?? null
      : null;
    this.selectedRepairType.set(type);
    this.result.set(null);
  }

  async createQuote(): Promise<void> {
    const model = this.selectedModel();
    const repairType = this.selectedRepairType();
    if (!model || !repairType || this.quoteLoading()) return;

    this.quoteLoading.set(true);
    this.result.set(null);
    try {
      let result = await firstValueFrom(
        this.quickQuoteApi.preview({
          deviceCatalogModelId: model.id,
          repairNeedId: repairType.id,
        }),
      );
      this.result.set(result);

      const settings = this.settings();
      if (
        result.confidence === 'high' &&
        result.matchedPart &&
        settings?.autoRememberApprovedMatches &&
        settings.autoCreatePricingTemplates
      ) {
        await this.rememberCandidate(result.matchedPart, true);
        result = this.result() ?? result;
      }
    } catch (error: any) {
      console.error(error);
      this.toast.error(
        'Quote could not be calculated',
        error?.error?.message ?? 'Check the device, repair type, and supplier connection.',
      );
    } finally {
      this.quoteLoading.set(false);
    }
  }

  async rememberCandidate(candidate: QuickQuoteCandidate, automatic = false): Promise<void> {
    const model = this.selectedModel();
    const repairType = this.selectedRepairType();
    if (!model || !repairType || this.remembering()) return;

    this.remembering.set(true);
    try {
      await firstValueFrom(
        this.quickQuoteApi.remember({
          deviceCatalogModelId: model.id,
          repairNeedId: repairType.id,
          candidate,
          variantName: 'Standard',
        }),
      );

      const refreshed = await firstValueFrom(
        this.quickQuoteApi.preview({
          deviceCatalogModelId: model.id,
          repairNeedId: repairType.id,
        }),
      );
      this.result.set(refreshed);
      if (!automatic) {
        this.toast.success('Part remembered', 'Opscend will use this approved match next time.');
      }
    } catch (error: any) {
      console.error(error);
      this.toast.error(
        'Part could not be remembered',
        error?.error?.message ?? 'The supplier part was not saved.',
      );
    } finally {
      this.remembering.set(false);
    }
  }

  async startRepair(): Promise<void> {
    const result = this.result();
    if (!result?.pricingTemplateId) return;

    this.close();
    await this.router.navigate(['/repairs/create'], {
      queryParams: {
        quickQuote: '1',
        quickQuoteModelId: result.device.id,
        quickQuoteRepairNeedId: result.repairNeed.id,
        quickQuotePricingTemplateId: result.pricingTemplateId,
      },
    });
  }

  reset(): void {
    this.result.set(null);
  }

  money(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  confidenceLabel(result: QuickQuotePreview): string {
    switch (result.confidence) {
      case 'approved':
        return result.source === 'template' ? 'Approved pricing' : 'Remembered match';
      case 'high':
        return 'Part matched';
      case 'review':
        return 'Choose part';
      default:
        return 'No part found';
    }
  }

}
