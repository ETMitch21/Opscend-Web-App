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
  UsersIcon,
  VoicemailIcon,
  Music2Icon,
  PlusIcon,
  Trash2Icon,
  LucideAngularModule,
} from 'lucide-angular';
import { firstValueFrom, forkJoin } from 'rxjs';

import {
  VoiceAgentCall,
  VoiceAgentSettings,
  VoiceAgentSettingsPatch,
} from '../../../core/voice-agent/model';
import { VoiceAgentService } from '../../../core/voice-agent/service';
import { PbxRingGroup, PbxSettings, PbxSettingsPatch } from '../../../core/pbx/model';
import { PbxService } from '../../../core/pbx/service';
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
  private readonly pbxApi = inject(PbxService);

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
    Users: UsersIcon,
    Voicemail: VoicemailIcon,
    Music: Music2Icon,
    Plus: PlusIcon,
    Trash: Trash2Icon,
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
  readonly pbxSettings = signal<PbxSettings | null>(null);
  readonly groupMembers = signal<Record<string, string[]>>({});
  readonly groupNames = signal<Partial<Record<string, string>>>({});
  readonly groupTimeouts = signal<Partial<Record<string, number>>>({});
  readonly groupSaving = signal<string | null>(null);
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

  readonly pbxForm = this.fb.group({
    enabled: [false],
    routingMode: ['ai_first' as 'ai_first' | 'ring_group_first'],
    afterHoursRoutingMode: ['voicemail' as 'voicemail' | 'ai'],
    greetingEnabled: [true],
    greeting: ['', Validators.maxLength(2000)],
    ringTimeoutSeconds: [25, [Validators.required, Validators.min(5), Validators.max(120)]],
    voicemailEnabled: [true],
    voicemailTranscriptionEnabled: [false],
    voicemailGreeting: ['', Validators.maxLength(3000)],
    voicemailMaxSeconds: [120, [Validators.required, Validators.min(15), Validators.max(300)]],
    holdMusicUrl: [''],
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
      const [settings, calls, pbx] = await Promise.all([
        firstValueFrom(this.voiceAgentApi.getSettings()),
        firstValueFrom(this.voiceAgentApi.listCalls(25)),
        firstValueFrom(this.pbxApi.getSettings()),
      ]);
      this.settings.set(settings);
      this.calls.set(calls);
      this.pbxSettings.set(pbx);
      this.patchForm(settings);
      this.patchPbxForm(pbx);
    } catch (error) {
      console.error(error);
      this.error.set('The AI phone agent settings could not be loaded.');
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  save(): void {
    if (this.settingsForm.invalid || this.pbxForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.pbxForm.markAllAsTouched();
      return;
    }

    const raw = this.settingsForm.getRawValue();
    const voicePayload: VoiceAgentSettingsPatch = {
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
    const pbxRaw = this.pbxForm.getRawValue();
    const pbxPayload: PbxSettingsPatch = {
      enabled: Boolean(pbxRaw.enabled),
      routingMode: pbxRaw.routingMode === 'ring_group_first' ? 'ring_group_first' : 'ai_first',
      afterHoursRoutingMode: pbxRaw.afterHoursRoutingMode === 'ai' ? 'ai' : 'voicemail',
      greetingEnabled: Boolean(pbxRaw.greetingEnabled),
      greeting: this.nullable(pbxRaw.greeting),
      ringTimeoutSeconds: Number(pbxRaw.ringTimeoutSeconds ?? 25),
      voicemailEnabled: Boolean(pbxRaw.voicemailEnabled),
      voicemailTranscriptionEnabled: Boolean(pbxRaw.voicemailTranscriptionEnabled),
      voicemailGreeting: this.nullable(pbxRaw.voicemailGreeting),
      voicemailMaxSeconds: Number(pbxRaw.voicemailMaxSeconds ?? 120),
      holdMusicUrl: this.nullable(pbxRaw.holdMusicUrl),
    };

    this.saveState.set('saving');
    this.error.set(null);
    forkJoin({
      voice: this.voiceAgentApi.updateSettings(voicePayload),
      pbx: this.pbxApi.updateSettings(pbxPayload),
    }).subscribe({
      next: ({ voice, pbx }) => {
        this.settings.set(voice);
        this.pbxSettings.set(pbx);
        this.patchForm(voice);
        this.patchPbxForm(pbx);
        this.saveState.set('saved');
        window.setTimeout(() => {
          if (this.saveState() === 'saved') this.saveState.set('idle');
        }, 1800);
      },
      error: (error) => {
        console.error(error);
        this.saveState.set('error');
        this.error.set('The phone system settings could not be saved.');
      },
    });
  }

  isGroupMember(groupId: string, userId: string): boolean {
    return (this.groupMembers()[groupId] ?? []).includes(userId);
  }

  toggleGroupMember(groupId: string, userId: string, checked: boolean): void {
    this.groupMembers.update((current) => {
      const next = new Set(current[groupId] ?? []);
      if (checked) next.add(userId); else next.delete(userId);
      return { ...current, [groupId]: Array.from(next) };
    });
  }

  setGroupName(groupId: string, value: string): void {
    this.groupNames.update((current) => ({ ...current, [groupId]: value }));
  }

  setGroupTimeout(groupId: string, value: unknown): void {
    const seconds = Math.max(5, Math.min(120, Number(value) || 25));
    this.groupTimeouts.update((current) => ({ ...current, [groupId]: seconds }));
  }

  makeDefaultGroup(group: PbxRingGroup): void {
    this.groupSaving.set(group.id);
    this.pbxApi.updateRingGroup(group.id, { isDefault: true }).subscribe({
      next: () => { this.groupSaving.set(null); void this.load(true); },
      error: (error) => { console.error(error); this.groupSaving.set(null); this.error.set('The default ring group could not be changed.'); },
    });
  }

  saveGroup(group: PbxRingGroup): void {
    this.groupSaving.set(group.id);
    this.error.set(null);
    this.pbxApi.updateRingGroup(group.id, {
      name: (this.groupNames()[group.id] ?? group.name).trim() || group.name,
      enabled: group.enabled,
      isDefault: group.isDefault,
      strategy: 'simultaneous',
      timeoutSeconds: this.groupTimeouts()[group.id] ?? group.timeoutSeconds,
      sortOrder: group.sortOrder,
      userIds: this.groupMembers()[group.id] ?? [],
    }).subscribe({
      next: () => { this.groupSaving.set(null); void this.load(true); },
      error: (error) => { console.error(error); this.groupSaving.set(null); this.error.set('The ring group could not be saved.'); },
    });
  }

  createGroup(): void {
    this.groupSaving.set('new');
    this.pbxApi.createRingGroup({
      name: 'New ring group',
      enabled: true,
      isDefault: (this.pbxSettings()?.groups.length ?? 0) === 0,
      strategy: 'simultaneous',
      timeoutSeconds: Number(this.pbxForm.controls.ringTimeoutSeconds.value ?? 25),
      userIds: [],
    }).subscribe({
      next: () => { this.groupSaving.set(null); void this.load(true); },
      error: (error) => { console.error(error); this.groupSaving.set(null); this.error.set('The ring group could not be created.'); },
    });
  }

  deleteGroup(group: PbxRingGroup): void {
    if (!window.confirm(`Delete ${group.name}?`)) return;
    this.groupSaving.set(group.id);
    this.pbxApi.deleteRingGroup(group.id).subscribe({
      next: () => { this.groupSaving.set(null); void this.load(true); },
      error: (error) => { console.error(error); this.groupSaving.set(null); this.error.set('The ring group could not be deleted.'); },
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

  private patchPbxForm(settings: PbxSettings): void {
    this.pbxForm.patchValue({
      enabled: settings.enabled,
      routingMode: settings.routingMode,
      afterHoursRoutingMode: settings.afterHoursRoutingMode,
      greetingEnabled: settings.greetingEnabled,
      greeting: settings.greeting ?? '',
      ringTimeoutSeconds: settings.ringTimeoutSeconds,
      voicemailEnabled: settings.voicemailEnabled,
      voicemailTranscriptionEnabled: settings.voicemailTranscriptionEnabled,
      voicemailGreeting: settings.voicemailGreeting ?? '',
      voicemailMaxSeconds: settings.voicemailMaxSeconds,
      holdMusicUrl: settings.holdMusicUrl ?? '',
    }, { emitEvent: false });
    this.groupMembers.set(Object.fromEntries(settings.groups.map((group) => [group.id, group.members.filter((member) => member.enabled).map((member) => member.userId)])));
    this.groupNames.set(Object.fromEntries(settings.groups.map((group) => [group.id, group.name])));
    this.groupTimeouts.set(Object.fromEntries(settings.groups.map((group) => [group.id, group.timeoutSeconds])));
  }

  private nullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
