// src/app/features/auth/login/login.component.ts
import { Component, inject } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../../core/auth/auth.service";
import { CommonModule } from "@angular/common";
import { ToastService } from "../../../core/toast/toast-service";

@Component({
  selector: "app-login",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink
],
  templateUrl: "./login-component.html",
})
export class LoginComponent {

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = false;

  form: FormGroup = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid) return;

    const { email, password } = this.form.getRawValue();
    if (!email || !password) return;

    this.loading = true;
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading = false;
        const returnUrl = new URLSearchParams(window.location.search).get("returnUrl") || "/";
        this.router.navigateByUrl(returnUrl);
      },
      error: (e) => {
        this.loading = false;
        this.toast.error(e?.error?.error ?? "Login failed");
      },
    });
  }
}