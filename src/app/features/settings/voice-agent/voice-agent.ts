import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PhoneCallIcon,
  RefreshCwIcon,
  SaveIcon,
  SendIcon,
  ShieldCheckIcon,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import {
  VoiceAgentCall,
  VoiceAgentSettings,
  VoiceAgentSettingsPatch,
} from '../../../core/voice-agent/model';
import { VoiceAgentService } from '../../../core/voice-agent/service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-voice-agent-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SettingsLayoutComponent,
    LucideAngularModule,
  ],
  templateUrl: './voice-agent.html',
  styleUrl: './voice-agent.scss',
})
export class VoiceAgentSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly voiceAgentApi = inject(VoiceAgentService);

  readonly icons = {
    AlertCircle: AlertCircleIcon,
    Bot: BotIcon,
    CheckCircle2: CheckCircle2Icon,
    ChevronDown: ChevronDownIcon,
    Copy: CopyIcon,
    ExternalLink: ExternalLinkIcon,
    Loader2: Loader2Icon,
    PhoneCall: PhoneCallIcon,
    RefreshCw: RefreshCwIcon,
    Save: SaveIcon,
    Send: SendIcon,
    ShieldCheck: ShieldCheckIcon,
  };

  readonly voiceOptions = [
    { value: 'marin', label: 'Marin' },
    { value: 'cedar', label: 'Cedar' },
    { value: 'alloy', label: 'Alloy' },
    { value: 'coral', label: 'Coral' },
    { value: 'sage', label: 'Sage' },
    { value: 'verse', label: 'Verse' },
  ];

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly saveState = signal<SaveState>('idle');
  readonly error = signal<string | null>(null);
  readonly settings = signal<VoiceAgentSettings | null>(null);
  readonly calls = signal<VoiceAgentCall[]>([]);
  readonly expandedCallId = signal<string | null>(null);
  readonly copiedField = signal<string | null>(null);

  readonly setupCompleteCount = computed(() => {
    const configuration = this.settings()?.configured;
    if (!configuration) return 0;
    return [
      configuration.openAiApiKey,
      configuration.openAiWebhookSecret,
      configuration.openAiProjectId,
      configuration.twilioNumber,
    ].filter(Boolean).length;
  });

  readonly settingsForm = this.fb.group({
    enabled: [false],
    agentName: ['Opscend Assistant', [Validators.required, Validators.maxLength(80)]],
    greeting: ['', Validators.maxLength(1200)],
    instructions: ['', Validators.maxLength(12000)],
    model: ['gpt-realtime-2.1', Validators.required],
    voice: ['marin', Validators.required],
    reasoningEffort: ['low', Validators.required],
    voicePhoneNumber: [''],
    transferPhone: [''],
    allowAutoQuotes: [true],
    autoSendQuoteSms: [true],
    allowManualQuoteRequests: [true],
    recordTranscripts: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(refresh = false): Promise<void> {
    if (refresh) this.refreshing.set(true);
    else this.loading.set(true);
    this.error.set(null);

    try {
      const [settings, calls] = await Promise.all([
        firstValueFrom(this.voiceAgentApi.getSettings()),
        firstValueFrom(this.voiceAgentApi.listCalls(25)),
      ]);
      this.settings.set(settings);
      this.calls.set(calls);
      this.patchForm(settings);
    } catch (error) {
      console.error(error);
      this.error.set('The AI phone agent settings could not be loaded.');
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  save(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    const raw = this.settingsForm.getRawValue();
    const payload: VoiceAgentSettingsPatch = {
      enabled: Boolean(raw.enabled),
      agentName: String(raw.agentName ?? '').trim(),
      greeting: this.nullable(raw.greeting),
      instructions: this.nullable(raw.instructions),
      model: String(raw.model ?? '').trim(),
      voice: String(raw.voice ?? '').trim(),
      reasoningEffort: String(raw.reasoningEffort ?? 'low'),
      voicePhoneNumber: this.nullable(raw.voicePhoneNumber),
      transferPhone: this.nullable(raw.transferPhone),
      allowAutoQuotes: Boolean(raw.allowAutoQuotes),
      autoSendQuoteSms: Boolean(raw.autoSendQuoteSms),
      allowManualQuoteRequests: Boolean(raw.allowManualQuoteRequests),
      recordTranscripts: Boolean(raw.recordTranscripts),
    };

    this.saveState.set('saving');
    this.error.set(null);
    this.voiceAgentApi.updateSettings(payload).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.patchForm(settings);
        this.saveState.set('saved');
        window.setTimeout(() => {
          if (this.saveState() === 'saved') this.saveState.set('idle');
        }, 1800);
      },
      error: (error) => {
        console.error(error);
        this.saveState.set('error');
        this.error.set('The AI phone agent settings could not be saved.');
      },
    });
  }

  toggleCall(callId: string): void {
    this.expandedCallId.update((current) => (current === callId ? null : callId));
  }

  async copy(value: string | null, field: string): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField.set(field);
      window.setTimeout(() => {
        if (this.copiedField() === field) this.copiedField.set(null);
      }, 1600);
    } catch {
      this.error.set('The value could not be copied to your clipboard.');
    }
  }

  callLabel(call: VoiceAgentCall): string {
    return call.customer?.name || call.callerPhone || 'Unknown caller';
  }

  callDetail(call: VoiceAgentCall): string {
    const pieces = [call.quote?.repairNeedLabel, call.quote?.brand, call.quote?.model].filter(Boolean);
    return pieces.join(' · ') || this.outcomeLabel(call.outcome);
  }

  outcomeLabel(outcome: string | null): string {
    switch (outcome) {
      case 'quote_created':
        return 'Quote created';
      case 'quote_request_created':
        return 'Quote request created';
      case 'transferred':
        return 'Transferred';
      case 'failed':
        return 'Failed';
      case 'ended':
        return 'Call ended';
      default:
        return 'No outcome yet';
    }
  }

  statusLabel(status: string): string {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  quoteTotal(call: VoiceAgentCall): string | null {
    const cents = call.quote?.estimatedTotalCents;
    if (cents == null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  callDuration(call: VoiceAgentCall): string {
    const start = new Date(call.answeredAt ?? call.startedAt).getTime();
    const end = new Date(call.endedAt ?? Date.now()).getTime();
    const seconds = Math.max(0, Math.round((end - start) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  private patchForm(settings: VoiceAgentSettings): void {
    this.settingsForm.patchValue(
      {
        enabled: settings.enabled,
        agentName: settings.agentName,
        greeting: settings.greeting ?? '',
        instructions: settings.instructions ?? '',
        model: settings.model,
        voice: settings.voice,
        reasoningEffort: settings.reasoningEffort,
        voicePhoneNumber: settings.voicePhoneNumber ?? '',
        transferPhone: settings.transferPhone ?? '',
        allowAutoQuotes: settings.allowAutoQuotes,
        autoSendQuoteSms: settings.autoSendQuoteSms,
        allowManualQuoteRequests: settings.allowManualQuoteRequests,
        recordTranscripts: settings.recordTranscripts,
      },
      { emitEvent: false },
    );
  }

  private nullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
