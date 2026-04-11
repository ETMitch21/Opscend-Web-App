import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { finalize } from "rxjs";
import { MobileSentrixService } from "../../../core/mobilesentrix/mobilesentrix-service";
import { MobileSentrixStatusResponse } from "../../../core/mobilesentrix/mobilesentrix-model";

type BannerTone = "success" | "error" | null;

@Component({
  selector: "app-shop-integrations",
  imports: [CommonModule],
  templateUrl: "./shop-integrations.html",
  styleUrl: "./shop-integrations.scss",
})
export class ShopIntegrations {
  private readonly mobilesentrix = inject(MobileSentrixService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  status: MobileSentrixStatusResponse | null = null;

  loadingStatus = true;
  connecting = false;
  disconnecting = false;

  bannerTone: BannerTone = null;
  bannerMessage = "";

  ngOnInit(): void {
    this.handleCallbackQueryState();
    this.loadStatus();
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
          this.bannerTone = "error";
          this.bannerMessage = "We couldn't load the MobileSentrix connection status.";
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

    const confirmed = window.confirm("Disconnect MobileSentrix from this shop?");
    if (!confirmed) return;

    this.disconnecting = true;

    this.mobilesentrix
      .disconnect()
      .pipe(finalize(() => (this.disconnecting = false)))
      .subscribe({
        next: () => {
          this.bannerTone = "success";
          this.bannerMessage = "MobileSentrix disconnected.";
          this.loadStatus();
        },
        error: () => {
          this.bannerTone = "error";
          this.bannerMessage = "We couldn't disconnect MobileSentrix.";
        },
      });
  }

  get isConnected(): boolean {
    return !!this.status?.connected;
  }

  private handleCallbackQueryState(): void {
    const params = this.route.snapshot.queryParamMap;
    const msState = params.get("mobilesentrix");
    const reason = params.get("reason");
    const code = params.get("code");

    if (msState === "success") {
      this.bannerTone = "success";
      this.bannerMessage = "MobileSentrix connected successfully.";
      this.clearIntegrationQueryParams();
      return;
    }

    if (msState === "error") {
      this.bannerTone = "error";
      this.bannerMessage = this.buildErrorMessage(reason, code);
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

  private clearIntegrationQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        mobilesentrix: null,
        reason: null,
        code: null,
      },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
}