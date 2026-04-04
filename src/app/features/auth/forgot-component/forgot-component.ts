import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/toast/toast-service';

@Component({
  selector: 'app-forgot-component',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './forgot-component.html',
  styleUrl: './forgot-component.scss',
})
export class ForgotComponent {

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  loading = false;

  form: FormGroup = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
  });

  submit() {
    if (this.form.invalid) return;

    const { email } = this.form.getRawValue();
    if (!email) return;

    this.loading = true;
    this.auth.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading = false;
        this.toast.info("If that email exists, a reset link has been sent.");
      },
      error: (e) => {
        this.loading = false;
        this.toast.error("Something went wrong. Please try again.");
      },
    });
  }

}
