import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ModalComponent } from '../../modal-component/modal-component';
import { ManageDevicesModalService } from './manage-devices-modal-service';
import { CustomerDevicesStore } from '../../../core/customer-devices/customer-devices.store';
import { ToastService } from '../../../core/toast/toast-service';

type DeviceForm = FormGroup<{
  nickname: FormControl<string>;
  brand: FormControl<string>;
  model: FormControl<string>;
  imei: FormControl<string>;
  serial: FormControl<string>;
  notes: FormControl<string>;
}>;

@Component({
  selector: 'manage-devices-modal-component',
  imports: [ModalComponent, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './manage-devices-modal-component.html',
  styleUrl: './manage-devices-modal-component.scss',
})
export class ManageDevicesModalComponent implements OnInit {
  private readonly modalService = inject(ManageDevicesModalService);
  private readonly customerDeviceStore = inject(CustomerDevicesStore);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  public customerId: string | null = null;
  public showDeviceModal = false;
  public modalStatus: 'edit' | 'new' = 'new';

  private nicknameManuallyEdited = false;

  public readonly deviceForm: DeviceForm = new FormGroup({
    nickname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.minLength(2)],
    }),
    brand: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    model: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    imei: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(15)],
    }),
    serial: new FormControl('', {
      nonNullable: true,
      validators: [Validators.minLength(1)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  ngOnInit(): void {
    this.modalService.customerId$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((customerId) => {
        this.customerId = customerId;
      });

    this.modalService.showDeviceModal$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        this.showDeviceModal = status;

        if (status) {
          this.setupModal();
        }
      });

    this.deviceForm.controls.nickname.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if ((value ?? '').trim().length > 0) {
          this.nicknameManuallyEdited = true;
        }
      });

    this.deviceForm.controls.brand.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncGeneratedNickname();
      });

    this.deviceForm.controls.model.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncGeneratedNickname();
      });
  }

  private setupModal(): void {
    const selected = this.customerDeviceStore.selected();
    this.modalStatus = selected ? 'edit' : 'new';
    this.nicknameManuallyEdited = false;

    if (selected) {
      this.deviceForm.patchValue({
        nickname: selected.nickname ?? '',
        brand: selected.brand ?? '',
        model: selected.model ?? '',
        imei: selected.imei ?? '',
        serial: selected.serial ?? '',
        notes: selected.notes ?? '',
      });

      this.nicknameManuallyEdited = !!selected.nickname?.trim();
      return;
    }

    this.deviceForm.reset({
      nickname: '',
      brand: '',
      model: '',
      imei: '',
      serial: '',
      notes: '',
    });
  }

  openDeviceModal(): void {
    this.modalService.open(this.customerId ?? undefined);
  }

  closeDeviceModal(): void {
    this.customerDeviceStore.clearSelected();
    this.modalService.close();
  }

  async saveDevice(): Promise<void> {
    if (this.deviceForm.invalid) {
      this.deviceForm.markAllAsTouched();
      return;
    }

    const selected = this.customerDeviceStore.selected();
    const formValue = this.deviceForm.getRawValue();
    const displayName = this.buildDisplayName(formValue.brand, formValue.model);
    const nickname = formValue.nickname.trim();

    try {
      if (selected) {
        await this.customerDeviceStore.update(selected.id, {
          nickname,
          displayName,
          brand: formValue.brand,
          model: formValue.model,
          imei: formValue.imei,
          serial: formValue.serial,
          notes: formValue.notes,
        });

        this.toastService.success('Device Updated Successfully');
        this.closeDeviceModal();
        return;
      }

      if (!this.customerId) {
        this.toastService.error('Missing customer', 'No customer was provided for this device.');
        return;
      }

      await this.customerDeviceStore.create(this.customerId, {
        nickname,
        displayName,
        brand: formValue.brand,
        model: formValue.model,
        imei: formValue.imei,
        serial: formValue.serial,
        notes: formValue.notes,
      });

      this.toastService.success('Device Created Successfully');
      this.closeDeviceModal();
    } catch (e: any) {
      this.toastService.error(e);
    }
  }

  private syncGeneratedNickname(): void {
    if (this.modalStatus === 'edit' || this.nicknameManuallyEdited) return;

    const generated = this.buildDisplayName(
      this.deviceForm.controls.brand.value,
      this.deviceForm.controls.model.value
    );

    this.deviceForm.controls.nickname.setValue(generated, { emitEvent: false });
  }

  private buildDisplayName(brand: string, model: string): string {
    return [brand.trim(), model.trim()].filter((part) => part.length > 0).join(' ');
  }
}