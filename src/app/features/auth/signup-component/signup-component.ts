import { Component, inject } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../../../core/auth/auth.service";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-signup",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: "./signup-component.html",
})
export class SignupComponent {

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  loading = false;
  error: string | null = null;

  form = this.fb.group({
    shopName: ["", Validators.required],
    slug: ["", Validators.required],
    ownerName: ["", Validators.required],
    ownerEmail: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  async submit() {
    if (this.form.invalid) return;

    this.loading = true;
    this.error = null;

    try {
      const res = await firstValueFrom(
        this.auth.signup(this.form.value as any)
      );

      // 🔑 load user
      await this.auth.loadMe();

      // 🚀 redirect to tenant subdomain
      const base = window.location.hostname.includes("localhost")
        ? "lvh.me:4200"
        : "app.opscend.app";

      window.location.href = `https://${res.shopSlug}.${base}`;
    } catch (err: any) {
      this.error = err?.error?.error || "signup_failed";
    } finally {
      this.loading = false;
    }
  }
}