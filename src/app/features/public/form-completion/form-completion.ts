import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
  LucideAngularModule,
} from 'lucide-angular';

import { FormsService } from '../../../core/forms/service';
import { FormField, PublicFormResponse } from '../../../core/forms/model';
import { SignaturePadComponent } from '../../../core/forms/signature-pad';

@Component({
  selector: 'app-form-completion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SignaturePadComponent],
  templateUrl: './form-completion.html',
})
export class FormCompletion implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly formsApi = inject(FormsService);

  readonly icons = { CheckCircle2, ClipboardList, Loader2, ShieldCheck, Upload, XCircle };
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = signal<PublicFormResponse['data'] | null>(null);
  readonly responses = signal<Record<string, unknown>>({});
  readonly brandColor = computed(() => {
    const value = this.form()?.shop?.primaryColor?.trim();
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#0f172a';
  });

  private token = '';

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token')?.trim() ?? '';
    if (!this.token) {
      this.error.set('This form link is incomplete.');
      this.loading.set(false);
      return;
    }
    try {
      const response = await firstValueFrom(this.formsApi.getPublicForm(this.token));
      this.form.set(response.data);
      this.responses.set(this.defaultResponses(response.data.template?.fields ?? []));
      if (response.data.status === 'completed') this.completed.set(true);
    } catch (error) {
      console.error(error);
      this.error.set('This form is unavailable or the link is no longer active.');
    } finally {
      this.loading.set(false);
    }
  }

  visibleField(field: FormField): boolean {
    const logic = field.conditionalLogic;
    if (!logic?.fieldKey) return true;
    const actual = this.responses()[logic.fieldKey];
    switch (logic.operator) {
      case 'not_equals': return String(actual ?? '') !== String(logic.value ?? '');
      case 'contains': return Array.isArray(actual) ? actual.map(String).includes(String(logic.value ?? '')) : String(actual ?? '').includes(String(logic.value ?? ''));
      case 'is_checked': return actual === true;
      case 'is_not_checked': return actual !== true;
      case 'equals':
      default: return String(actual ?? '') === String(logic.value ?? '');
    }
  }

  value(key: string): unknown {
    return this.responses()[key];
  }

  setValue(key: string, value: unknown): void {
    this.responses.update((responses) => ({ ...responses, [key]: value }));
  }

  checkboxGroupChecked(field: FormField, value: string): boolean {
    const current = this.responses()[field.key];
    return Array.isArray(current) && current.map(String).includes(value);
  }

  toggleCheckboxGroup(field: FormField, value: string, checked: boolean): void {
    const currentValue = this.responses()[field.key];
    const current = Array.isArray(currentValue) ? currentValue.map(String) : [];
    this.setValue(field.key, checked ? [...new Set([...current, value])] : current.filter((item) => item !== value));
  }

  async capturePhoto(field: FormField, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      this.error.set('Photos must be smaller than 2 MB.');
      input.value = '';
      return;
    }
    this.setValue(field.key, await this.fileToDataUrl(file));
  }

  isImageValue(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('data:image/');
  }

  async submit(): Promise<void> {
    const form = this.form();
    if (!form) return;
    this.error.set(null);
    const validation = this.validateResponses(form.template?.fields ?? []);
    if (validation) {
      this.error.set(validation);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.submitting.set(true);
    try {
      await firstValueFrom(this.formsApi.submitPublicForm(this.token, this.responses()));
      this.completed.set(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error(error);
      const firstIssue = error?.error?.issues?.[0]?.message;
      this.error.set(firstIssue || 'The form could not be submitted. Please review your answers and try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  private defaultResponses(fields: FormField[]): Record<string, unknown> {
    return Object.fromEntries(fields.map((field) => [field.key, field.type === 'checkbox' ? false : field.type === 'checkbox_group' ? [] : '']));
  }

  private validateResponses(fields: FormField[]): string | null {
    const values = this.responses();
    for (const field of fields) {
      if (!field.required || !this.visibleField(field) || ['heading', 'paragraph'].includes(field.type)) continue;
      const value = values[field.key];
      const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0) || (field.type === 'checkbox' && value !== true);
      if (empty) return `${field.label} is required.`;
    }
    return null;
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
