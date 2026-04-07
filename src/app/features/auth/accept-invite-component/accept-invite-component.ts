import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast-service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-accept-invite-component',
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './accept-invite-component.html',
  styleUrl: './accept-invite-component.scss',
})
export class AcceptInviteComponent {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private token: string | null = null;

  public password: string | null = null;
  public loading: boolean = false;

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get("token");
  }

  async submit() {
    if (!this.token) {
      this.toast.error('Invalid invite link');
      return;
    }

    if (!this.password || this.password.length < 8) {
      this.toast.error('Password must be at least 8 characters');
      return;
    }

    this.loading = true;

    try {
      await firstValueFrom(this.auth.acceptInvite(this.token, this.password));
      this.router.navigateByUrl('/login');
    } catch (err: any) {
      this.toast.error(err?.error?.error || 'Something went wrong');
    } finally {
      this.loading = false;
    }
  }

}
