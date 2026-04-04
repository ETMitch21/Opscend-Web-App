import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';

@Injectable({
  providedIn: 'root',
})
export class ToastService {

  success(message: string, description?: string) {
    toast.success(message, { description });
  }

  error(message: string, description?: string) {
    toast.error(message, { description });
  }

  info(message: string, description?: string) {
    toast(message, { description });
  }

  loading(message: string) {
    return toast.loading(message);
  }

  confirm(
    message: string,
    onConfirm: () => void,
    description?: string,
    confirmLabel = 'Confirm',
  ) {
    toast.error(message, {
      description,
      duration: 10000,
      action: {
        label: confirmLabel,
        onClick: () => onConfirm(),
      }
    });
  }

  dismiss(id?: string | number) {
    toast.dismiss(id);
  }
}
