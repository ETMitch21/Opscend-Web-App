import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Archive,
  ArrowLeft,
  Bold,
  Code2,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListFilter,
  ListOrdered,
  Loader2,
  Paperclip,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Save,
  Search,
  Tag,
  Trash2,
  Underline,
  Unlink,
  Undo2,
  Upload,
  X,
  LucideAngularModule,
} from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import {
  KnowledgeArticle,
  KnowledgeArticlePayload,
  KnowledgeArticleStatus,
  KnowledgeBootstrapResponse,
  KnowledgeCategory,
  KnowledgeContextResponse,
  KnowledgeDeviceModelOption,
  KnowledgeServiceOption,
  KnowledgeVisibility,
} from '../../core/knowledge-base/model';
import { KnowledgeBaseService } from '../../core/knowledge-base/service';
import { ToastService } from '../../core/toast/toast-service';

type StatusFilter = 'all' | KnowledgeArticleStatus;
type EditorBlock = 'p' | 'h2' | 'h3' | 'blockquote' | 'pre';
type EditorInlineFormat = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

type ArticleDraft = KnowledgeArticlePayload & {
  id: string | null;
  tagsText: string;
};

const EMPTY_DRAFT: ArticleDraft = {
  id: null,
  title: '',
  summary: '',
  body: '',
  categoryId: null,
  status: 'draft',
  visibility: 'internal',
  tags: [],
  tagsText: '',
  pinned: false,
  serviceIds: [],
  deviceModelIds: [],
  repairId: null,
  workQueueItemId: null,
};

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './knowledge-base.html',
  styleUrl: './knowledge-base.scss',
})
export class KnowledgeBase implements OnInit {
  @ViewChild('bodyEditor') private bodyEditor?: ElementRef<HTMLDivElement>;

  private readonly api = inject(KnowledgeBaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private savedEditorRange: Range | null = null;

  readonly icons = {
    Archive,
    ArrowLeft,
    Bold,
    BookOpen,
    Code2,
    Check,
    ChevronRight,
    Download,
    ExternalLink,
    FileText,
    Folder,
    FolderPlus,
    Heading2,
    Heading3,
    Italic,
    Link,
    List,
    ListFilter,
    ListOrdered,
    Loader2,
    Paperclip,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Pin,
    Plus,
    Quote,
    Redo2,
    RemoveFormatting,
    Save,
    Search,
    Tag,
    Trash2,
    Underline,
    Unlink,
    Undo2,
    Upload,
    X,
  };

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly bootstrap = signal<KnowledgeBootstrapResponse>({ categories: [], services: [], deviceModels: [] });
  readonly articles = signal<KnowledgeArticle[]>([]);
  readonly selectedArticle = signal<KnowledgeArticle | null>(null);
  readonly context = signal<KnowledgeContextResponse | null>(null);

  readonly searchQuery = signal('');
  readonly categoryFilter = signal('all');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly tagFilter = signal('all');

  readonly sidebarCollapsed = signal(false);
  readonly editorOpen = signal(false);
  readonly currentEditorBlock = signal<EditorBlock>('p');
  readonly activeEditorFormats = signal<ReadonlySet<EditorInlineFormat>>(new Set<EditorInlineFormat>());
  readonly draft = signal<ArticleDraft>({ ...EMPTY_DRAFT });
  readonly serviceSearch = signal('');
  readonly deviceSearch = signal('');

  readonly categoryManagerOpen = signal(false);
  readonly categoryEditingId = signal<string | null>(null);
  readonly categoryName = signal('');
  readonly categoryDescription = signal('');

  readonly canWrite = computed(() => {
    const role = String(this.auth.getCurrentUser()?.role ?? '').toLowerCase();
    return role === 'owner' || role === 'manager';
  });

  readonly categories = computed(() => this.bootstrap().categories);
  readonly services = computed(() => this.bootstrap().services);
  readonly deviceModels = computed(() => this.bootstrap().deviceModels);

  readonly allTags = computed(() =>
    [...new Set(this.articles().flatMap((article) => article.tags))].sort((a, b) => a.localeCompare(b)),
  );

  readonly filteredArticles = computed(() => {
    const search = this.searchQuery().trim().toLowerCase();
    const categoryId = this.categoryFilter();
    const status = this.statusFilter();
    const tag = this.tagFilter();

    return this.articles().filter((article) => {
      if (categoryId !== 'all' && article.categoryId !== categoryId) return false;
      if (status !== 'all' && article.status !== status) return false;
      if (tag !== 'all' && !article.tags.includes(tag)) return false;
      if (!search) return true;

      const haystack = [
        article.title,
        article.summary,
        this.bodyToPlainText(article.body),
        article.category?.name,
        article.tags.join(' '),
        article.services.map((service) => service.name).join(' '),
        article.deviceModels.map((device) => `${device.brand ?? ''} ${device.name}`).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  });

  readonly filteredServices = computed(() => {
    const search = this.serviceSearch().trim().toLowerCase();
    const selected = new Set(this.draft().serviceIds);
    const rows = this.services().filter((service) =>
      !search || `${service.name} ${service.code ?? ''}`.toLowerCase().includes(search),
    );
    return [...rows].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))).slice(0, 40);
  });

  readonly filteredDeviceModels = computed(() => {
    const search = this.deviceSearch().trim().toLowerCase();
    const selected = new Set(this.draft().deviceModelIds);
    const rows = this.deviceModels().filter((device) =>
      !search || `${device.brand} ${device.name} ${device.category}`.toLowerCase().includes(search),
    );
    return [...rows].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))).slice(0, 50);
  });

  readonly selectedRenderedBody = computed<SafeHtml>(() =>
    this.renderArticleBody(this.selectedArticle()?.body ?? ''),
  );

  async ngOnInit(): Promise<void> {
    await this.reload();

    this.route.queryParamMap.subscribe((params) => {
      const repairId = params.get('repairId');
      const workQueueItemId = params.get('workQueueItemId');
      const articleId = params.get('article');

      if (repairId || workQueueItemId) {
        void this.loadContext({ repairId: repairId ?? undefined, workQueueItemId: workQueueItemId ?? undefined });
      } else {
        this.context.set(null);
      }

      if (articleId) {
        const article = this.articles().find((item) => item.id === articleId);
        if (article) this.selectedArticle.set(article);
        else void this.loadArticle(articleId);
      }
    });
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [bootstrap, articleResponse] = await Promise.all([
        firstValueFrom(this.api.bootstrap()),
        firstValueFrom(this.api.listArticles({ limit: 500 })),
      ]);
      this.bootstrap.set(bootstrap);
      this.articles.set(articleResponse.data);
      const selectedId = this.selectedArticle()?.id;
      const nextSelected = selectedId
        ? articleResponse.data.find((article) => article.id === selectedId) ?? articleResponse.data[0] ?? null
        : articleResponse.data[0] ?? null;
      this.selectedArticle.set(nextSelected);
    } catch (error) {
      this.error.set(this.errorMessage(error, 'Unable to load the knowledge base.'));
    } finally {
      this.loading.set(false);
    }
  }

  async loadArticle(id: string): Promise<void> {
    try {
      const article = await firstValueFrom(this.api.getArticle(id));
      this.articles.update((items) => [article, ...items.filter((item) => item.id !== article.id)]);
      this.selectedArticle.set(article);
    } catch (error) {
      this.toast.error('Article unavailable', this.errorMessage(error, 'The article could not be loaded.'));
    }
  }

  async loadContext(params: { repairId?: string; workQueueItemId?: string }): Promise<void> {
    try {
      this.context.set(await firstValueFrom(this.api.getContext(params)));
    } catch (error) {
      this.context.set(null);
      this.toast.error('Context unavailable', this.errorMessage(error, 'Related guidance could not be loaded.'));
    }
  }

  selectArticle(article: KnowledgeArticle): void {
    this.selectedArticle.set(article);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { article: article.id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openNewArticle(): void {
    if (!this.canWrite()) return;
    const context = this.context()?.context;
    this.draft.set({
      ...EMPTY_DRAFT,
      categoryId: this.categories()[0]?.id ?? null,
      repairId: context?.repairId ?? null,
      workQueueItemId: context?.type === 'work_queue' ? context.id : null,
    });
    this.serviceSearch.set('');
    this.deviceSearch.set('');
    this.editorOpen.set(true);
    this.syncEditorFromDraft();
  }

  openEditArticle(article: KnowledgeArticle): void {
    if (!this.canWrite()) return;
    this.draft.set({
      id: article.id,
      title: article.title,
      summary: article.summary,
      body: this.toEditorHtml(article.body),
      categoryId: article.categoryId,
      status: article.status,
      visibility: article.visibility,
      tags: [...article.tags],
      tagsText: article.tags.join(', '),
      pinned: article.pinned,
      serviceIds: article.services.map((service) => service.id),
      deviceModelIds: article.deviceModels.map((device) => device.id),
      repairId: null,
      workQueueItemId: null,
    });
    this.serviceSearch.set('');
    this.deviceSearch.set('');
    this.editorOpen.set(true);
    this.syncEditorFromDraft();
  }

  closeEditor(): void {
    if (this.saving() || this.uploading()) return;
    this.editorOpen.set(false);
    this.savedEditorRange = null;
    this.currentEditorBlock.set('p');
    this.activeEditorFormats.set(new Set<EditorInlineFormat>());
  }

  patchDraft(patch: Partial<ArticleDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...patch }));
  }

  toggleService(service: KnowledgeServiceOption): void {
    this.draft.update((draft) => ({
      ...draft,
      serviceIds: draft.serviceIds.includes(service.id)
        ? draft.serviceIds.filter((id) => id !== service.id)
        : [...draft.serviceIds, service.id],
    }));
  }

  toggleDeviceModel(device: KnowledgeDeviceModelOption): void {
    this.draft.update((draft) => ({
      ...draft,
      deviceModelIds: draft.deviceModelIds.includes(device.id)
        ? draft.deviceModelIds.filter((id) => id !== device.id)
        : [...draft.deviceModelIds, device.id],
    }));
  }

  isServiceSelected(id: string): boolean {
    return this.draft().serviceIds.includes(id);
  }

  isDeviceSelected(id: string): boolean {
    return this.draft().deviceModelIds.includes(id);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    if (!this.editorOpen()) return;
    this.rememberEditorSelection();
  }

  onEditorInput(event: Event): void {
    const editor = event.currentTarget as HTMLDivElement;
    this.patchDraft({ body: editor.innerHTML });
    this.rememberEditorSelection();
  }

  onEditorFocus(): void {
    this.configureNativeEditor();
    this.rememberEditorSelection();
  }

  onEditorInteraction(): void {
    this.rememberEditorSelection();
  }

  onEditorBlur(): void {
    this.captureEditorBody();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.rememberEditorSelection();
      this.insertEditorLink();
    }
  }

  onEditorPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const sourceHtml = clipboard.getData('text/html');
    const sourceText = clipboard.getData('text/plain');
    const cleanHtml = sourceHtml
      ? this.sanitizeRichHtml(sourceHtml)
      : this.plainTextToEditorHtml(sourceText);

    this.restoreEditorSelection();
    this.configureNativeEditor();
    document.execCommand('insertHTML', false, cleanHtml);
    this.captureEditorBody();
    this.rememberEditorSelection();
  }

  prepareEditorToolbarAction(event: MouseEvent): void {
    this.rememberEditorSelection();
    event.preventDefault();
  }

  applyEditorCommand(command: EditorInlineFormat | 'undo' | 'redo' | 'removeFormat'): void {
    const editor = this.bodyEditor?.nativeElement;
    if (!editor) return;

    this.restoreEditorSelection();
    this.configureNativeEditor();
    editor.focus({ preventScroll: true });
    document.execCommand(command, false);
    this.captureEditorBody();
    this.rememberEditorSelection();
  }

  setEditorBlock(tag: EditorBlock): void {
    const editor = this.bodyEditor?.nativeElement;
    if (!editor) return;

    this.restoreEditorSelection();
    this.configureNativeEditor();
    editor.focus({ preventScroll: true });

    const current = this.getCurrentEditorBlock();
    const target: EditorBlock = current === tag && tag !== 'p' ? 'p' : tag;
    const formatted = document.execCommand('formatBlock', false, `<${target}>`);
    if (!formatted) document.execCommand('formatBlock', false, target);

    this.captureEditorBody();
    this.rememberEditorSelection();
  }

  isEditorFormatActive(format: EditorInlineFormat): boolean {
    return this.activeEditorFormats().has(format);
  }

  isEditorBlockActive(block: EditorBlock): boolean {
    return this.currentEditorBlock() === block;
  }

  insertEditorLink(): void {
    const editor = this.bodyEditor?.nativeElement;
    if (!editor) return;

    this.rememberEditorSelection();
    const rawUrl = window.prompt('Enter the link URL');
    if (!rawUrl?.trim()) {
      this.restoreEditorSelection();
      return;
    }

    const url = this.normalizeLink(rawUrl.trim());
    if (!url) {
      this.toast.error('Invalid link', 'Use an http, https, mailto, or tel link.');
      this.restoreEditorSelection();
      return;
    }

    this.restoreEditorSelection();
    this.configureNativeEditor();
    editor.focus({ preventScroll: true });

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    if (selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = url;
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      document.execCommand('createLink', false, url);
      for (const anchor of Array.from(editor.querySelectorAll<HTMLAnchorElement>('a'))) {
        if (anchor.getAttribute('href') === url || anchor.href === url) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        }
      }
    }

    this.captureEditorBody();
    this.rememberEditorSelection();
  }

  async saveArticle(): Promise<void> {
    const current = this.draft();
    if (!current.title.trim()) {
      this.toast.error('Title required', 'Give the article a clear title before saving.');
      return;
    }

    const tags = [...new Set(current.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean))];
    const payload: KnowledgeArticlePayload = {
      title: current.title.trim(),
      summary: current.summary?.trim() || null,
      body: this.sanitizeRichHtml(this.captureEditorBody()),
      categoryId: current.categoryId || null,
      status: current.status,
      visibility: current.visibility,
      tags,
      pinned: current.pinned,
      serviceIds: current.serviceIds,
      deviceModelIds: current.deviceModelIds,
      ...(current.id ? {} : { repairId: current.repairId, workQueueItemId: current.workQueueItemId }),
    };

    this.saving.set(true);
    try {
      const saved = current.id
        ? await firstValueFrom(this.api.updateArticle(current.id, payload))
        : await firstValueFrom(this.api.createArticle(payload));
      this.articles.update((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      this.selectedArticle.set(saved);
      this.editorOpen.set(false);
      this.toast.success(current.id ? 'Article updated' : 'Article created', saved.title);
      await this.refreshContext();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { article: saved.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch (error) {
      this.toast.error('Article not saved', this.errorMessage(error, 'Review the article and try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  async archiveArticle(article: KnowledgeArticle): Promise<void> {
    if (!this.canWrite()) return;
    try {
      const updated = await firstValueFrom(this.api.updateArticle(article.id, { status: 'archived' }));
      this.replaceArticle(updated);
      this.toast.success('Article archived', updated.title);
    } catch (error) {
      this.toast.error('Archive failed', this.errorMessage(error, 'The article could not be archived.'));
    }
  }

  async deleteArticle(article: KnowledgeArticle): Promise<void> {
    if (!this.canWrite() || !window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
    try {
      await firstValueFrom(this.api.deleteArticle(article.id));
      this.articles.update((items) => items.filter((item) => item.id !== article.id));
      this.selectedArticle.set(this.articles()[0] ?? null);
      this.toast.success('Article deleted', article.title);
      await this.refreshContext();
    } catch (error) {
      this.toast.error('Delete failed', this.errorMessage(error, 'The article could not be deleted.'));
    }
  }

  async linkToContext(article: KnowledgeArticle): Promise<void> {
    const context = this.context()?.context;
    if (!context || !this.canWrite()) return;
    try {
      const updated = await firstValueFrom(
        this.api.linkArticle(article.id, {
          repairId: context.type === 'repair' ? context.id : context.repairId,
          workQueueItemId: context.type === 'work_queue' ? context.id : null,
        }),
      );
      this.replaceArticle(updated);
      this.toast.success('Article linked', `“${article.title}” is now attached to this ${context.type === 'repair' ? 'repair' : 'work item'}.`);
      await this.refreshContext();
    } catch (error) {
      this.toast.error('Link failed', this.errorMessage(error, 'The article could not be linked.'));
    }
  }

  async unlinkFromContext(article: KnowledgeArticle): Promise<void> {
    const context = this.context()?.context;
    if (!context || !this.canWrite()) return;
    try {
      const updated = await firstValueFrom(
        this.api.unlinkArticle(article.id, {
          repairId: context.type === 'repair' ? context.id : context.repairId,
          workQueueItemId: context.type === 'work_queue' ? context.id : null,
        }),
      );
      this.replaceArticle(updated);
      this.toast.success('Article unlinked', article.title);
      await this.refreshContext();
    } catch (error) {
      this.toast.error('Unlink failed', this.errorMessage(error, 'The article could not be unlinked.'));
    }
  }

  articleLinkedToContext(article: KnowledgeArticle): boolean {
    const context = this.context()?.context;
    if (!context) return false;
    if (context.type === 'repair') return article.repairIds.includes(context.id);
    return article.workQueueItemIds.includes(context.id) || Boolean(context.repairId && article.repairIds.includes(context.repairId));
  }

  async uploadArticleAttachment(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const articleId = this.draft().id;
    input.value = '';
    if (!file || !articleId) return;

    this.uploading.set(true);
    try {
      await firstValueFrom(this.api.uploadAttachment(articleId, file));
      const updated = await firstValueFrom(this.api.getArticle(articleId));
      this.replaceArticle(updated);
      this.patchDraft({ id: updated.id });
      this.toast.success('Attachment uploaded', file.name);
    } catch (error) {
      this.toast.error('Upload failed', this.errorMessage(error, 'The attachment could not be uploaded.'));
    } finally {
      this.uploading.set(false);
    }
  }

  async downloadAttachment(article: KnowledgeArticle, attachmentId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getAttachmentDownloadUrl(article.id, attachmentId));
      window.open(response.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      this.toast.error('Download failed', this.errorMessage(error, 'The attachment could not be downloaded.'));
    }
  }

  async deleteAttachment(article: KnowledgeArticle, attachmentId: string): Promise<void> {
    if (!this.canWrite() || !window.confirm('Delete this attachment?')) return;
    try {
      await firstValueFrom(this.api.deleteAttachment(article.id, attachmentId));
      const updated = await firstValueFrom(this.api.getArticle(article.id));
      this.replaceArticle(updated);
      this.toast.success('Attachment deleted', 'The file was removed from the article.');
    } catch (error) {
      this.toast.error('Delete failed', this.errorMessage(error, 'The attachment could not be deleted.'));
    }
  }

  openCategoryManager(category?: KnowledgeCategory): void {
    if (!this.canWrite()) return;
    this.categoryEditingId.set(category?.id ?? null);
    this.categoryName.set(category?.name ?? '');
    this.categoryDescription.set(category?.description ?? '');
    this.categoryManagerOpen.set(true);
  }

  resetCategoryEditor(): void {
    this.categoryEditingId.set(null);
    this.categoryName.set('');
    this.categoryDescription.set('');
  }

  async saveCategory(): Promise<void> {
    const name = this.categoryName().trim();
    if (!name) return;
    this.saving.set(true);
    try {
      const id = this.categoryEditingId();
      const saved = id
        ? await firstValueFrom(this.api.updateCategory(id, { name, description: this.categoryDescription().trim() || null }))
        : await firstValueFrom(this.api.createCategory({ name, description: this.categoryDescription().trim() || null, sortOrder: this.categories().length }));
      this.bootstrap.update((state) => ({
        ...state,
        categories: [...state.categories.filter((category) => category.id !== saved.id), saved].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      }));
      this.resetCategoryEditor();
      this.toast.success(id ? 'Category updated' : 'Category created', saved.name);
    } catch (error) {
      this.toast.error('Category not saved', this.errorMessage(error, 'Try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteCategory(category: KnowledgeCategory): Promise<void> {
    if (!window.confirm(`Delete “${category.name}”? Articles will remain uncategorized.`)) return;
    try {
      await firstValueFrom(this.api.deleteCategory(category.id));
      this.bootstrap.update((state) => ({ ...state, categories: state.categories.filter((item) => item.id !== category.id) }));
      if (this.categoryFilter() === category.id) this.categoryFilter.set('all');
      this.toast.success('Category deleted', category.name);
    } catch (error) {
      this.toast.error('Delete failed', this.errorMessage(error, 'The category could not be deleted.'));
    }
  }

  closeContext(): void {
    this.context.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { repairId: null, workQueueItemId: null },
      queryParamsHandling: 'merge',
    });
  }

  statusLabel(status: KnowledgeArticleStatus): string {
    return status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft';
  }

  visibilityLabel(visibility: KnowledgeVisibility): string {
    if (visibility === 'customer_portal') return 'Customer portal';
    if (visibility === 'public') return 'Public';
    return 'Internal only';
  }

  statusClasses(status: KnowledgeArticleStatus): string {
    if (status === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'archived') return 'border-slate-200 bg-slate-100 text-slate-600';
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  formatBytes(value: number | null): string {
    if (!value) return 'Unknown size';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  private replaceArticle(article: KnowledgeArticle): void {
    this.articles.update((items) => [article, ...items.filter((item) => item.id !== article.id)]);
    if (this.selectedArticle()?.id === article.id) this.selectedArticle.set(article);
  }

  private async refreshContext(): Promise<void> {
    const context = this.context()?.context;
    if (!context) return;
    await this.loadContext({
      repairId: context.type === 'repair' ? context.id : undefined,
      workQueueItemId: context.type === 'work_queue' ? context.id : undefined,
    });
  }

  private syncEditorFromDraft(): void {
    window.setTimeout(() => {
      const editor = this.bodyEditor?.nativeElement;
      if (!editor) return;
      editor.innerHTML = this.sanitizeRichHtml(this.draft().body);
      this.savedEditorRange = null;
      this.currentEditorBlock.set('p');
      this.activeEditorFormats.set(new Set<EditorInlineFormat>());
      this.configureNativeEditor();
    });
  }

  private configureNativeEditor(): void {
    try {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Older WebKit builds can reject editor configuration before focus.
    }
  }

  private rememberEditorSelection(): void {
    const editor = this.bodyEditor?.nativeElement;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!this.rangeBelongsToEditor(range, editor)) return;

    this.savedEditorRange = range.cloneRange();
    this.updateEditorToolbarState(range);
  }

  private restoreEditorSelection(): void {
    const editor = this.bodyEditor?.nativeElement;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    editor.focus({ preventScroll: true });
    selection.removeAllRanges();

    if (this.savedEditorRange && this.rangeBelongsToEditor(this.savedEditorRange, editor)) {
      selection.addRange(this.savedEditorRange);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
    this.savedEditorRange = range.cloneRange();
  }

  private rangeBelongsToEditor(range: Range, editor: HTMLElement): boolean {
    const start = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentNode;
    const end = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer
      : range.endContainer.parentNode;
    return Boolean(start && end && (start === editor || editor.contains(start)) && (end === editor || editor.contains(end)));
  }

  private updateEditorToolbarState(range: Range): void {
    const formats = new Set<EditorInlineFormat>();
    const commands: EditorInlineFormat[] = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
    for (const command of commands) {
      try {
        if (document.queryCommandState(command)) formats.add(command);
      } catch {
        // Querying an unsupported command should not interrupt editing.
      }
    }
    this.activeEditorFormats.set(formats);
    this.currentEditorBlock.set(this.getCurrentEditorBlock(range));
  }

  private getCurrentEditorBlock(range?: Range): EditorBlock {
    const editor = this.bodyEditor?.nativeElement;
    const selection = window.getSelection();
    const activeRange = range ?? (selection?.rangeCount ? selection.getRangeAt(0) : null);
    if (!editor || !activeRange) return 'p';

    let element = activeRange.startContainer.nodeType === Node.ELEMENT_NODE
      ? activeRange.startContainer as HTMLElement
      : activeRange.startContainer.parentElement;

    while (element && element !== editor) {
      const tag = element.tagName.toLowerCase();
      if (tag === 'h2' || tag === 'h3' || tag === 'blockquote' || tag === 'pre' || tag === 'p') return tag;
      element = element.parentElement;
    }
    return 'p';
  }

  private captureEditorBody(): string {
    const editor = this.bodyEditor?.nativeElement;
    const body = editor?.innerHTML ?? this.draft().body;
    this.patchDraft({ body });
    return body;
  }

  private plainTextToEditorHtml(value: string): string {
    return value
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${this.escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private renderArticleBody(body: string): SafeHtml {
    const html = this.looksLikeHtml(body) ? body : this.markdownToHtml(body);
    return this.sanitizer.bypassSecurityTrustHtml(this.sanitizeRichHtml(html));
  }

  private toEditorHtml(body: string): string {
    if (!body.trim()) return '';
    return this.sanitizeRichHtml(this.looksLikeHtml(body) ? body : this.markdownToHtml(body));
  }

  private bodyToPlainText(body: string): string {
    if (!body) return '';
    if (!this.looksLikeHtml(body)) return body;
    const documentValue = new DOMParser().parseFromString(body, 'text/html');
    return documentValue.body.textContent ?? '';
  }

  private looksLikeHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value);
  }

  private markdownToHtml(markdown: string): string {
    const escaped = this.escapeHtml(markdown);
    const inline = (value: string) =>
      value
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const lines = escaped.split('\n');
    const output: string[] = [];
    let inCode = false;
    let inList: 'ul' | 'ol' | null = null;

    const closeList = () => {
      if (inList) output.push(`</${inList}>`);
      inList = null;
    };

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        closeList();
        output.push(inCode ? '</code></pre>' : '<pre><code>');
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        output.push(`${line}\n`);
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = Math.min(4, heading[1].length + 1);
        output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }

      const unordered = line.match(/^[-*]\s+(.+)$/);
      if (unordered) {
        if (inList !== 'ul') {
          closeList();
          output.push('<ul>');
          inList = 'ul';
        }
        output.push(`<li>${inline(unordered[1])}</li>`);
        continue;
      }

      const ordered = line.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        if (inList !== 'ol') {
          closeList();
          output.push('<ol>');
          inList = 'ol';
        }
        output.push(`<li>${inline(ordered[1])}</li>`);
        continue;
      }

      closeList();
      if (!line.trim()) output.push('<p><br></p>');
      else if (line.startsWith('&gt; ')) output.push(`<blockquote>${inline(line.slice(5))}</blockquote>`);
      else output.push(`<p>${inline(line)}</p>`);
    }

    closeList();
    if (inCode) output.push('</code></pre>');
    return output.join('');
  }

  private sanitizeRichHtml(rawHtml: string): string {
    if (!rawHtml.trim()) return '';

    const parsed = new DOMParser().parseFromString(rawHtml, 'text/html');
    this.normalizeBrowserFormatting(parsed.body);
    const allowedTags = new Set([
      'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H2', 'H3', 'H4', 'HR',
      'I', 'LI', 'OL', 'P', 'PRE', 'STRONG', 'U', 'UL',
    ]);
    const removeEntirely = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON']);

    const clean = (parent: ParentNode): void => {
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.COMMENT_NODE) {
          node.remove();
          continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const element = node as HTMLElement;
        if (removeEntirely.has(element.tagName)) {
          element.remove();
          continue;
        }

        if (!allowedTags.has(element.tagName)) {
          clean(element);
          element.replaceWith(...Array.from(element.childNodes));
          continue;
        }

        const originalHref = element.tagName === 'A' ? element.getAttribute('href') : null;
        for (const attribute of Array.from(element.attributes)) {
          element.removeAttribute(attribute.name);
        }

        if (element.tagName === 'A') {
          const href = this.normalizeLink(originalHref ?? '');
          if (href) {
            element.setAttribute('href', href);
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noopener noreferrer');
          }
        }
        clean(element);
      }
    };

    clean(parsed.body);
    return parsed.body.innerHTML;
  }

  private normalizeBrowserFormatting(parent: ParentNode): void {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const element = node as HTMLElement;
      this.normalizeBrowserFormatting(element);

      const style = (element.getAttribute('style') ?? '').toLowerCase();
      const bold = /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
      const italic = /font-style\s*:\s*italic/.test(style);
      const underline = /text-decoration(?:-line)?\s*:[^;]*underline/.test(style);
      const isDisposableInline = element.tagName === 'SPAN' || element.tagName === 'FONT';

      if (!bold && !italic && !underline) {
        if (isDisposableInline) element.replaceWith(...Array.from(element.childNodes));
        continue;
      }

      const fragment = document.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);

      let wrapped: Node = fragment;
      if (underline) {
        const wrapper = document.createElement('u');
        wrapper.appendChild(wrapped);
        wrapped = wrapper;
      }
      if (italic) {
        const wrapper = document.createElement('em');
        wrapper.appendChild(wrapped);
        wrapped = wrapper;
      }
      if (bold) {
        const wrapper = document.createElement('strong');
        wrapper.appendChild(wrapped);
        wrapped = wrapper;
      }

      if (isDisposableInline) {
        element.replaceWith(wrapped);
      } else {
        element.appendChild(wrapped);
        element.removeAttribute('style');
      }
    }
  }

  private normalizeLink(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    return null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private errorMessage(error: unknown, fallback: string): string {
    const value = error as { error?: { message?: string; error?: string }; message?: string };
    return value?.error?.message || value?.error?.error || value?.message || fallback;
  }
}
