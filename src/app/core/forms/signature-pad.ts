import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <canvas
        #canvas
        class="block h-40 w-full touch-none bg-white"
        (pointerdown)="start($event)"
        (pointermove)="move($event)"
        (pointerup)="end()"
        (pointercancel)="end()"
        (pointerleave)="end()"
      ></canvas>
      <div class="flex items-center justify-between border-t border-slate-100 px-3 py-2">
        <span class="text-xs text-slate-400">Sign inside the box</span>
        <button type="button" class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" (click)="clear()">Clear</button>
      </div>
    </div>
  `,
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() value: string | null = null;
  @Output() valueChange = new EventEmitter<string>();

  private drawing = false;
  private context: CanvasRenderingContext2D | null = null;

  ngAfterViewInit(): void {
    this.resize();
    if (this.value?.startsWith('data:image/')) this.load(this.value);
  }

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.context = canvas.getContext('2d');
    if (!this.context) return;
    this.context.scale(ratio, ratio);
    this.context.lineWidth = 2;
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.strokeStyle = '#0f172a';
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  start(event: PointerEvent): void {
    event.preventDefault();
    this.canvasRef.nativeElement.setPointerCapture?.(event.pointerId);
    const point = this.point(event);
    this.drawing = true;
    this.context?.beginPath();
    this.context?.moveTo(point.x, point.y);
  }

  move(event: PointerEvent): void {
    if (!this.drawing || !this.context) return;
    event.preventDefault();
    const point = this.point(event);
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
  }

  end(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.context?.closePath();
    this.valueChange.emit(this.canvasRef.nativeElement.toDataURL('image/png'));
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    this.context?.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    this.valueChange.emit('');
  }

  private load(value: string): void {
    const image = new Image();
    image.onload = () => {
      const canvas = this.canvasRef.nativeElement;
      const rect = canvas.getBoundingClientRect();
      this.context?.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = value;
  }
}
