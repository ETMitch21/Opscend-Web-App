import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechDayView } from "../../components/tech-day-view/tech-day-view";

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, TechDayView],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {

  readonly todayHeaderLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

}
