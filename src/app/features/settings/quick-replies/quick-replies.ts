import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  PencilIcon,
  Loader2Icon,
  MessageCircle,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
  Zap,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import { CommunicationService } from '../../../core/communications/service';
import type {
  CommunicationQuickReply,
  CommunicationQuickReplyChannel,
} from '../../../core/communications/model';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-quick-replies-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SettingsLayoutComponent, LucideAngularModule],
  templateUrl: './quick-replies.html',
})
export class QuickRepliesSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommunicationService);

  readonly icons = {
    ArrowDown: ArrowDownIcon,
    ArrowUp: ArrowUpIcon,
    Check: CheckCircle2Icon,
    Edit: PencilIcon,
    Loader: Loader2Icon,
    Message: MessageCircle,
    Plus: PlusIcon,
    Save: SaveIcon,
    Trash: Trash2Icon,
    X: XIcon,
    Zap,
  };

  readonly loading = signal(true);
  readonly saveState = signal<SaveState>('idle');
  readonly error = signal<string | null>(null);
  readonly replies = signal<CommunicationQuickReply[]>([]);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    body: ['', [Validators.required, Validators.maxLength(4000)]],
    sms: [true],
    email: [true],
    webChat: [true],
    isActive: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.listQuickReplies());
      this.replies.set(response.data ?? []);
    } catch (error) {
      console.error(error);
      this.error.set('Quick replies could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  add(): void {
    this.editingId.set(null);
    this.form.reset({ title: '', body: '', sms: true, email: true, webChat: true, isActive: true });
    this.editorOpen.set(true);
    this.saveState.set('idle');
  }

  edit(reply: CommunicationQuickReply): void {
    this.editingId.set(reply.id);
    this.form.reset({
      title: reply.title,
      body: reply.body,
      sms: reply.channels.includes('sms'),
      email: reply.channels.includes('email'),
      webChat: reply.channels.includes('web_chat'),
      isActive: reply.isActive,
    });
    this.editorOpen.set(true);
    this.saveState.set('idle');
  }

  cancel(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.saveState.set('idle');
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saveState() === 'saving') {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const channels: CommunicationQuickReplyChannel[] = [];
    if (raw.sms) channels.push('sms');
    if (raw.email) channels.push('email');
    if (raw.webChat) channels.push('web_chat');
    if (!channels.length) {
      this.error.set('Choose at least one channel for this quick reply.');
      return;
    }

    this.saveState.set('saving');
    this.error.set(null);
    try {
      const payload = {
        title: String(raw.title ?? '').trim(),
        body: String(raw.body ?? '').trim(),
        channels,
        isActive: Boolean(raw.isActive),
      };
      const id = this.editingId();
      if (id) {
        await firstValueFrom(this.api.updateQuickReply(id, payload));
      } else {
        await firstValueFrom(this.api.createQuickReply(payload));
      }
      await this.load();
      this.editorOpen.set(false);
      this.editingId.set(null);
      this.saveState.set('saved');
      window.setTimeout(() => this.saveState.set('idle'), 1200);
    } catch (error) {
      console.error(error);
      this.saveState.set('error');
      this.error.set('Quick reply could not be saved.');
    }
  }

  async remove(reply: CommunicationQuickReply): Promise<void> {
    if (!window.confirm(`Delete “${reply.title}”?`)) return;
    this.error.set(null);
    try {
      await firstValueFrom(this.api.deleteQuickReply(reply.id));
      this.replies.update((items) => items.filter((item) => item.id !== reply.id));
      if (this.editingId() === reply.id) this.cancel();
    } catch (error) {
      console.error(error);
      this.error.set('Quick reply could not be deleted.');
    }
  }

  async move(index: number, direction: -1 | 1): Promise<void> {
    const items = [...this.replies()];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target]!, items[index]!];
    this.replies.set(items);
    try {
      const response = await firstValueFrom(this.api.reorderQuickReplies(items.map((item) => item.id)));
      this.replies.set(response.data ?? items);
    } catch (error) {
      console.error(error);
      this.error.set('Quick reply order could not be saved.');
      await this.load();
    }
  }

  channelLabel(reply: CommunicationQuickReply): string {
    const labels: Record<string, string> = { sms: 'SMS', email: 'Email', web_chat: 'Web Chat' };
    return reply.channels.map((channel) => labels[channel] ?? channel).join(' · ');
  }
}
