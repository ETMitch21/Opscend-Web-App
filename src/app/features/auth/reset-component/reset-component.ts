// reset-component.ts
import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ToastService } from "../../../core/toast/toast-service";
import { AuthService } from "../../../core/auth/auth.service";

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get("password")?.value ?? "";
  const confirmPassword = group.get("confirmPassword")?.value ?? "";
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordsMismatch: true };
}

@Component({
  selector: "app-reset",
  standalone: true,
  templateUrl: "./reset-component.html",
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class ResetComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  token: string | null = null;

  loading = false;
  showPassword = false;

  form = this.fb.group(
    {
      password: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get("token");

    if (!this.token) {
      this.toast.error("Missing reset token. Please use the reset link from your email and try again.");
      this.router.navigate(['/login']);
    }
  }

  get password() {
    return this.form.get("password");
  }

  get confirmPassword() {
    return this.form.get("confirmPassword");
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  goToLogin(): void {
    this.router.navigate(["/login"]);
  }

  submit(): void {
    if (!this.token) {
      this.toast.error("Missing reset token. Please use the reset link from your email and try again.");
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const password = this.password?.value ?? "";
    this.loading = true;
    this.auth.resetPassword(this.token, password).subscribe({
      next: () => {
        this.toast.success("Password updated. You can now sign in.");
        this.form.reset();
      },
      error: (err) => {
        const apiMsg =
          err?.error?.message ||
          err?.error?.error ||
          err?.message ||
          null;
        this.toast.error("Could not reset password. The link may have expired. Please request a new reset email.");
      }
    });
  }
}