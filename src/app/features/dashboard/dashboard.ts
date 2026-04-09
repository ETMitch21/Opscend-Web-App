import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechDayView } from "../../components/tech-day-view/tech-day-view";
import { ShopContextService } from '../../core/shop/shop-context.store';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, TechDayView],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {

  shopContext = inject(ShopContextService);

  readonly todayHeaderLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

}
