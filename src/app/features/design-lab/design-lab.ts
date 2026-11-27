import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-design-lab',
  standalone: true,
  imports: [MatButtonModule, MatSelectModule],
  templateUrl: './design-lab.html',
  styleUrl: './design-lab.css',
})
export class DesignLab {
  readonly light = signal(false);
  readonly search = signal('');
  readonly notice = signal('');
  readonly status = signal('In progress');
  readonly repairType = signal('Screen replacement');
  readonly statusOptions = ['In progress', 'Ready', 'Awaiting parts'];
  readonly repairTypeOptions = ['Screen replacement', 'Battery replacement'];
  readonly rows = [
    { id: 'REP-1042', device: 'iPhone 17 Pro', customer: 'Alex Morgan', status: 'In progress', tone: 'progress', price: '$179.00' },
    { id: 'REP-1041', device: 'iPhone 15', customer: 'Jamie Lee', status: 'Ready', tone: 'ready', price: '$129.00' },
    { id: 'REP-1040', device: 'iPad Air', customer: 'Taylor Reed', status: 'Awaiting parts', tone: 'waiting', price: '$149.00' },
  ];
  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.rows.filter(row => Object.values(row).some(value => value.toLowerCase().includes(query)));
  });
}
