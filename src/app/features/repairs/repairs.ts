
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-repairs',
  imports: [RouterModule],
  templateUrl: './repairs.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './repairs.scss',
})
export class Repairs {

}
