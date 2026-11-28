import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Search, OpscendIconComponent } from '../opscend-icon/index';
@Component({selector:'app-ops-search', standalone:true, imports:[OpscendIconComponent], template:`<div class="ops-search-field"><lucide-icon [name]="icon" [size]="16"></lucide-icon><input type="search" [attr.aria-label]="placeholder" [placeholder]="placeholder" [value]="value" (input)="valueChange.emit($any($event.target).value)" /></div>`})
export class OpsSearch {
 @Input() value = ''; @Input() placeholder = 'Search...'; @Output() valueChange = new EventEmitter<string>(); readonly icon = Search;
}
