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
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import type { WebChatSettings } from '../../../core/web-chat/model';
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
  };

  readonly loading = signal(true);
  readonly saveState = signal<SaveState>('idle');
  readonly error = signal<string | null>(null);
  readonly settings = signal<WebChatSettings | null>(null);
  readonly copied = signal(false);

  readonly form = this.fb.group({
    enabled: [false],
    assistantEnabled: [true],
    assistantName: ['Opscend Assistant', [Validators.required, Validators.maxLength(80)]],
    greeting: ['Hi! How can we help?', [Validators.required, Validators.maxLength(500)]],
    offlineMessage: ['', Validators.maxLength(800)],
    handoffEnabled: [true],
    requireContact: [false],
    allowAttachments: [{ value: false, disabled: true }],
    primaryColor: ['#111827', Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    position: ['right' as 'left' | 'right'],
    allowedOriginsText: [''],
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
        primaryColor: String(raw.primaryColor ?? '').trim() || null,
        position: raw.position === 'left' ? 'left' : 'right',
        allowedOrigins: origins,
      }));
      const settings = await firstValueFrom(this.api.getSettings());
      this.settings.set(settings);
      this.patch(settings);
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
      primaryColor: settings.primaryColor || '#111827',
      position: settings.position,
      allowedOriginsText: settings.allowedOrigins.join('\n'),
    }, { emitEvent: false });
  }

  private nullable(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }
}
