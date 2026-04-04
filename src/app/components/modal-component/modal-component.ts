import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-component.html',
  styleUrl: './modal-component.scss'
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() maxWidthClass = 'max-w-2xl';
  @Input() closeOnBackdrop = true;
  @Input() closeOnEscape = true;
  @Input() showCloseButton = true;

  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    if (!this.closeOnBackdrop) return;
    this.close();
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open || !this.closeOnEscape) return;
    this.close();
  }
}