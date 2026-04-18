import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { finalize } from "rxjs";
import { MobileSentrixService } from "../../../core/mobilesentrix/mobilesentrix-service";
import { MobileSentrixStatusResponse } from "../../../core/mobilesentrix/mobilesentrix-model";
import { StripeService } from "../../../core/stripe/stripe-service";
import { StripeStatusResponse } from "../../../core/stripe/stripe-model";
import { ToastService } from "../../../core/toast/toast-service";
import { CheckIcon, LucideAngularModule } from "lucide-angular";

@Component({
  selector: "app-shop-integrations",
  imports: [CommonModule, LucideAngularModule],
  templateUrl: "./shop-integrations.html",
  styleUrl: "./shop-integrations.scss",
})
export class ShopIntegrations {
  private readonly mobilesentrix = inject(MobileSentrixService);
  private readonly stripe = inject(StripeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  checkmarkIcon = CheckIcon;

  status: MobileSentrixStatusResponse | null = null;
  stripeStatus: StripeStatusResponse | null = null;

  loadingStatus = true;
  loadingStripeStatus = true;

  connecting = false;
  disconnecting = false;

  stripeConnecting = false;
  stripeDisconnecting = false;
  stripeOpeningDashboard = false;

  ngOnInit(): void {
    this.handleCallbackQueryState();
    this.loadStatus();
    this.loadStripeStatus();
  }

  loadStatus(): void {
    this.loadingStatus = true;

    this.mobilesentrix
      .getStatus()
      .pipe(finalize(() => (this.loadingStatus = false)))
      .subscribe({
        next: (res) => {
          this.status = res;
        },
        error: () => {
          this.status = null;
          this.toast.error("We couldn't load the MobileSentrix connection status.");
        },
      });
  }

  loadStripeStatus(): void {
    this.loadingStripeStatus = true;

    this.stripe
      .getStatus()
      .pipe(finalize(() => (this.loadingStripeStatus = false)))
      .subscribe({
        next: (res) => {
          this.stripeStatus = res;
        },
        error: () => {
          this.stripeStatus = null;
          this.toast.error("We couldn't load the Stripe connection status.");
        },
      });
  }

  onConnect(): void {
    if (this.connecting || this.isConnected) return;

    this.connecting = true;
    this.mobilesentrix.connect();
  }

  onDisconnect(): void {
    if (this.disconnecting) return;

    this.toast.confirm("Disconnect MobileSentrix from your shop?", () => {
      this.disconnecting = true;

      this.mobilesentrix
        .disconnect()
        .pipe(finalize(() => (this.disconnecting = false)))
        .subscribe({
          next: () => {
            this.toast.success("MobileSentrix disconnected");
            this.loadStatus();
          },
          error: () => {
            this.toast.error("We couldn't disconnect MobileSentrix, please try again.");
          },
        });
      }
    );
  }

  onStripeConnect(): void {
  if (this.stripeConnecting || this.isStripeConnected) return;

  this.stripeConnecting = true;

  this.stripe.connect()
    .catch(() => {
      this.toast.error("We couldn't start Stripe onboarding, please try again.");
      this.stripeConnecting = false;
    });
}

  onStripeDisconnect(): void {
    if (this.stripeDisconnecting) return;

    this.toast.confirm("Disconnect Stripe from your shop?", () => {
      this.stripeDisconnecting = true;

      this.stripe
        .disconnect()
        .pipe(finalize(() => (this.stripeDisconnecting = false)))
        .subscribe({
          next: () => {
            this.toast.success("Stripe disconnected.");
          },
          error: () => {
            this.toast.error("We couldn't disconnect Stripe, please try again.");
          }
        });
    });

  }

  onOpenStripeDashboard(): void {
    if (this.stripeOpeningDashboard || !this.isStripeConnected) return;

    this.stripeOpeningDashboard = true;

    try {
      this.stripe.openDashboard();
    } finally {
      this.stripeOpeningDashboard = false;
    }
  }

  get isConnected(): boolean {
    return !!this.status?.connected;
  }

  get isStripeConnected(): boolean {
    return !!this.stripeStatus?.connected;
  }

  private handleCallbackQueryState(): void {
    const params = this.route.snapshot.queryParamMap;

    const msState = params.get("mobilesentrix");
    const stripeState = params.get("stripe");
    const reason = params.get("reason");
    const code = params.get("code");

    if (msState === "success") {
      this.toast.success("MobileSentrix connected successfully.");
      this.clearIntegrationQueryParams();
      return;
    }

    if (msState === "error") {
      this.toast.error(this.buildErrorMessage(reason, code));
      this.clearIntegrationQueryParams();
      return;
    }

    if (stripeState === "success") {
      this.toast.success("Stripe connected successfully.");
      this.clearIntegrationQueryParams();
      return;
    }

    if (stripeState === "error") {
      this.toast.error(this.buildStripeErrorMessage(reason, code));
      this.clearIntegrationQueryParams();
    }
  }

  private buildErrorMessage(reason: string | null, code: string | null): string {
    switch (reason) {
      case "missing_callback_params":
        return "MobileSentrix did not return the callback values we expected.";
      case "missing_shop":
        return "We couldn't determine which shop this MobileSentrix connection belongs to.";
      case "oauth_failed":
        return code
          ? `MobileSentrix authorization failed. Error code: ${code}.`
          : "MobileSentrix authorization failed.";
      case "callback_failed":
        return "We couldn't complete the MobileSentrix callback.";
      default:
        return "Something went wrong while connecting MobileSentrix.";
    }
  }

  private buildStripeErrorMessage(reason: string | null, code: string | null): string {
    switch (reason) {
      case "missing_shop":
        return "We couldn't determine which shop this Stripe connection belongs to.";
      case "account_link_failed":
        return "We couldn't create the Stripe onboarding link.";
      case "dashboard_link_failed":
        return "We couldn't open the Stripe dashboard link.";
      case "callback_failed":
        return "We couldn't complete the Stripe connection flow.";
      default:
        return code
          ? `Something went wrong while connecting Stripe. Error code: ${code}.`
          : "Something went wrong while connecting Stripe.";
    }
  }

  private clearIntegrationQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        mobilesentrix: null,
        stripe: null,
        reason: null,
        code: null,
      },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
}