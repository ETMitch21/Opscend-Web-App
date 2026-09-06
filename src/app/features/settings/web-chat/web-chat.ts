import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BotIcon,
  CheckCircle2Icon,
  CopyIcon,
  BlocksIcon,
  Loader2Icon,
  MessageCircle,
  SaveIcon,
  ShieldCheckIcon,
  UserIcon,
  SparklesIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  MegaphoneIcon,
  StarIcon,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import type { WebChatProactiveRule, WebChatSettings } from '../../../core/web-chat/model';
import { WebChatService } from '../../../core/web-chat/service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-web-chat-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SettingsLayoutComponent, LucideAngularModule],
  templateUrl: './web-chat.html',
  styleUrl: './web-chat.scss',
})
export class WebChatSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(WebChatService);

  readonly icons = {
    Bot: BotIcon,
    CheckCircle2: CheckCircle2Icon,
    Copy: CopyIcon,
    Globe: BlocksIcon,
    Loader: Loader2Icon,
    MessageCircle,
    Save: SaveIcon,
    Shield: ShieldCheckIcon,
    User: UserIcon,
    Wand: SparklesIcon,
    Plus: PlusIcon,
    Pencil: PencilIcon,
    Trash: Trash2Icon,
    Megaphone: MegaphoneIcon,
    Star: StarIcon,
  };

  readonly loading = signal(true);
  readonly saveState = signal<SaveState>('idle');
  readonly error = signal<string | null>(null);
  readonly settings = signal<WebChatSettings | null>(null);
  readonly copied = signal(false);
  readonly copiedCustom = signal(false);
  readonly proactiveRules = signal<WebChatProactiveRule[]>([]);
  readonly proactiveSaving = signal(false);
  readonly editingProactiveRuleId = signal<string | null>(null);
  readonly previewSpace = signal<'home' | 'messages' | 'help'>('home');

  readonly form = this.fb.group({
    enabled: [false],
    assistantEnabled: [true],
    assistantName: ['Opscend Assistant', [Validators.required, Validators.maxLength(80)]],
    greeting: ['Hi! How can we help?', [Validators.required, Validators.maxLength(500)]],
    offlineMessage: ['', Validators.maxLength(800)],
    handoffEnabled: [true],
    requireContact: [false],
    allowAttachments: [false],
    proactiveEnabled: [false],
    csatEnabled: [true],
    primaryColor: ['#111827', Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    position: ['right' as 'left' | 'right'],
    allowedOriginsText: [''],
  });


  readonly proactiveForm = this.fb.group({
    name: ['Website helper', [Validators.required, Validators.maxLength(100)]],
    pathContains: ['', Validators.maxLength(300)],
    delaySeconds: [30, [Validators.required, Validators.min(5), Validators.max(600)]],
    message: ['', [Validators.required, Validators.maxLength(500)]],
    tag: ['', Validators.maxLength(80)],
    intent: ['', Validators.maxLength(80)],
    repeatPolicy: ['once_per_visitor' as 'once_per_visitor' | 'once_per_session' | 'after_days' | 'every_visit'],
    repeatAfterDays: [7, [Validators.min(1), Validators.max(365)]],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const settings = await firstValueFrom(this.api.getSettings());
      this.settings.set(settings);
      this.patch(settings);
      this.proactiveRules.set(settings.proactiveRules ?? []);
    } catch (error) {
      console.error(error);
      this.error.set('Web Chat settings could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saveState() === 'saving') {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const origins = String(raw.allowedOriginsText ?? '')
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    this.saveState.set('saving');
    this.error.set(null);
    try {
      await firstValueFrom(this.api.updateSettings({
        enabled: Boolean(raw.enabled),
        assistantEnabled: Boolean(raw.assistantEnabled),
        assistantName: String(raw.assistantName ?? '').trim(),
        greeting: String(raw.greeting ?? '').trim(),
        offlineMessage: this.nullable(raw.offlineMessage),
        handoffEnabled: Boolean(raw.handoffEnabled),
        requireContact: Boolean(raw.requireContact),
        allowAttachments: Boolean(raw.allowAttachments),
        proactiveEnabled: Boolean(raw.proactiveEnabled),
        csatEnabled: Boolean(raw.csatEnabled),
        primaryColor: String(raw.primaryColor ?? '').trim() || null,
        position: raw.position === 'left' ? 'left' : 'right',
        allowedOrigins: origins,
      }));
      const settings = await firstValueFrom(this.api.getSettings());
      this.settings.set(settings);
      this.patch(settings);
      this.proactiveRules.set(settings.proactiveRules ?? []);
      this.saveState.set('saved');
      window.setTimeout(() => {
        if (this.saveState() === 'saved') this.saveState.set('idle');
      }, 1800);
    } catch (error) {
      console.error(error);
      this.saveState.set('error');
      this.error.set('Web Chat settings could not be saved.');
    }
  }

  async copyEmbed(): Promise<void> {
    const embed = this.settings()?.embedScript;
    if (!embed) return;
    try {
      await navigator.clipboard.writeText(embed);
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 1600);
    } catch {
      this.error.set('The embed code could not be copied.');
    }
  }

  async copyCustomLauncher(): Promise<void> {
    const embed = this.settings()?.customLauncherScript;
    if (!embed) return;
    try {
      await navigator.clipboard.writeText(embed);
      this.copiedCustom.set(true);
      window.setTimeout(() => this.copiedCustom.set(false), 1600);
    } catch {
      this.error.set('The custom launcher code could not be copied.');
    }
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  editProactiveRule(rule: WebChatProactiveRule): void {
    this.editingProactiveRuleId.set(rule.id);
    this.proactiveForm.patchValue({
      name: rule.name,
      pathContains: rule.pathContains ?? '',
      delaySeconds: rule.delaySeconds,
      message: rule.message,
      tag: rule.tag ?? '',
      intent: rule.intent ?? '',
      repeatPolicy: rule.repeatPolicy ?? 'once_per_visitor',
      repeatAfterDays: rule.repeatAfterDays ?? 7,
    });
  }

  resetProactiveRuleEditor(): void {
    this.editingProactiveRuleId.set(null);
    this.proactiveForm.reset({
      name: 'Website helper',
      pathContains: '',
      delaySeconds: 30,
      message: '',
      tag: '',
      intent: '',
      repeatPolicy: 'once_per_visitor',
      repeatAfterDays: 7,
    });
  }

  async saveProactiveRule(): Promise<void> {
    if (this.proactiveForm.invalid || this.proactiveSaving()) {
      this.proactiveForm.markAllAsTouched();
      return;
    }
    const raw = this.proactiveForm.getRawValue();
    const editingId = this.editingProactiveRuleId();
    const editingRule = editingId ? this.proactiveRules().find((rule) => rule.id === editingId) : null;
    const payload = {
      name: String(raw.name ?? '').trim(),
      enabled: editingRule?.enabled ?? true,
      pathContains: this.nullable(raw.pathContains),
      delaySeconds: Number(raw.delaySeconds ?? 30),
      message: String(raw.message ?? '').trim(),
      tag: this.nullable(raw.tag),
      intent: this.nullable(raw.intent),
      repeatPolicy: raw.repeatPolicy ?? 'once_per_visitor',
      repeatAfterDays: raw.repeatPolicy === 'after_days' ? Number(raw.repeatAfterDays ?? 7) : null,
    };
    this.proactiveSaving.set(true);
    this.error.set(null);
    try {
      if (editingId) {
        const response = await firstValueFrom(this.api.updateProactiveRule(editingId, payload));
        this.proactiveRules.update((rules) => rules.map((rule) => rule.id === editingId ? response.data : rule));
      } else {
        const response = await firstValueFrom(this.api.createProactiveRule(payload));
        this.proactiveRules.update((rules) => [...rules, response.data]);
      }
      this.resetProactiveRuleEditor();
    } catch (error) {
      console.error(error);
      this.error.set('The proactive message could not be saved.');
    } finally {
      this.proactiveSaving.set(false);
    }
  }

  async toggleProactiveRule(rule: WebChatProactiveRule): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.updateProactiveRule(rule.id, { enabled: !rule.enabled }));
      this.proactiveRules.update((rules) => rules.map((item) => item.id === rule.id ? response.data : item));
    } catch (error) {
      console.error(error);
      this.error.set('The proactive message could not be updated.');
    }
  }

  async deleteProactiveRule(rule: WebChatProactiveRule): Promise<void> {
    if (!window.confirm(`Delete “${rule.name}”?`)) return;
    try {
      await firstValueFrom(this.api.deleteProactiveRule(rule.id));
      this.proactiveRules.update((rules) => rules.filter((item) => item.id !== rule.id));
      if (this.editingProactiveRuleId() === rule.id) this.resetProactiveRuleEditor();
    } catch (error) {
      console.error(error);
      this.error.set('The proactive message could not be deleted.');
    }
  }

  private patch(settings: WebChatSettings): void {
    this.form.patchValue({
      enabled: settings.enabled,
      assistantEnabled: settings.assistantEnabled,
      assistantName: settings.assistantName,
      greeting: settings.greeting,
      offlineMessage: settings.offlineMessage ?? '',
      handoffEnabled: settings.handoffEnabled,
      requireContact: settings.requireContact,
      allowAttachments: settings.allowAttachments,
      proactiveEnabled: settings.proactiveEnabled,
      csatEnabled: settings.csatEnabled,
      primaryColor: settings.primaryColor || '#111827',
      position: settings.position,
      allowedOriginsText: settings.allowedOrigins.join('\n'),
    }, { emitEvent: false });
  }


  proactiveRepeatLabel(rule: WebChatProactiveRule): string {
    switch (rule.repeatPolicy) {
      case 'once_per_session':
        return 'Once per session';
      case 'after_days':
        return `Again after ${rule.repeatAfterDays ?? 7} day${(rule.repeatAfterDays ?? 7) === 1 ? '' : 's'}`;
      case 'every_visit':
        return 'Every qualifying visit';
      default:
        return 'Once per visitor';
    }
  }

  private nullable(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }
}
