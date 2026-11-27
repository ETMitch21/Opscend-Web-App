import { Component, Input, numberAttribute } from '@angular/core';
import { LucideDynamicIcon as ModernLucideIcon, lucideLegacyIcon, type LucideIconData } from '@lucide/angular';

const emptyIcon = lucideLegacyIcon('opscend-empty', []);

/** Transitional adapter for existing Opscend icon bindings and CSS selectors.
 * New BuilderKit screens should use native standalone Lucide components instead.
 */
@Component({
  selector: 'lucide-icon, lucide-angular, i-lucide, span-lucide',
  standalone: true,
  imports: [ModernLucideIcon],
  template: '<svg [lucideIcon]="img ?? name ?? empty" [size]="size" aria-hidden="true"></svg>',
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; }
    svg { display: block; max-width: 100%; max-height: 100%; flex-shrink: 0; }
  `],
})
export class OpscendIconComponent {
  @Input() name: LucideIconData | string | null | undefined;
  @Input() img: LucideIconData | string | null | undefined;
  @Input({ transform: numberAttribute }) size = 24;
  protected readonly empty = emptyIcon;
}
