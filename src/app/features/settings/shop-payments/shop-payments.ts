import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/app-config/app-config.service';
import { SettingsLayoutComponent } from '../settings-layout/settings-layout';

type AdminDepositEnforcement = 'required' | 'allow_override' | 'disabled'; type FulfillmentStatus='unfulfilled'|'fulfilled';
interface ShopResponse { id:string; settings:{pos:{orders:{prefix:string|null;startNumber:number|null;padding:number|null;defaultFulfillmentStatus:FulfillmentStatus|null}}} }
interface PaymentSettings { adminDepositEnforcement:AdminDepositEnforcement; fullPrepaymentEnabled:boolean; fullPrepaymentDiscountPercent:number }
@Component({selector:'app-shop-payments-settings',standalone:true,imports:[CommonModule,FormsModule,RouterModule,SettingsLayoutComponent],templateUrl:'./shop-payments.html'})
export class ShopPaymentsSettings implements OnInit {
  private readonly appConfig=inject(AppConfigService); private readonly http=inject(HttpClient);
  readonly loading=signal(true); readonly saving=signal(false); readonly error=signal<string|null>(null); readonly success=signal<string|null>(null); readonly shopId=signal<string|null>(null);
  adminDepositEnforcement:AdminDepositEnforcement='allow_override'; fullPrepaymentEnabled=false; fullPrepaymentDiscountPercent=0; orderPrefix=''; orderStartNumber:number|null=1; orderPadding:number|null=4; defaultFulfillmentStatus:FulfillmentStatus='unfulfilled';
  private get apiBase(){return this.appConfig.config.apiBase;}
  ngOnInit():void{void this.load();}
  async load():Promise<void>{this.loading.set(true);this.error.set(null);try{const [shops,payments]=await Promise.all([firstValueFrom(this.http.get<{data:ShopResponse[]}>(`${this.apiBase}/shops`)),firstValueFrom(this.http.get<PaymentSettings>(`${this.apiBase}/booking-payments/settings`))]);const shop=shops.data?.[0];if(!shop)throw new Error('shop_not_found');this.shopId.set(shop.id);this.orderPrefix=shop.settings?.pos?.orders?.prefix??'';this.orderStartNumber=shop.settings?.pos?.orders?.startNumber??1;this.orderPadding=shop.settings?.pos?.orders?.padding??4;this.defaultFulfillmentStatus=shop.settings?.pos?.orders?.defaultFulfillmentStatus??'unfulfilled';this.adminDepositEnforcement=payments.adminDepositEnforcement??'allow_override';this.fullPrepaymentEnabled=!!payments.fullPrepaymentEnabled;this.fullPrepaymentDiscountPercent=payments.fullPrepaymentDiscountPercent??0;}catch(e){console.error(e);this.error.set('Payment settings could not be loaded.');}finally{this.loading.set(false);}}
  async save():Promise<void>{const shopId=this.shopId();if(!shopId)return;if(this.orderStartNumber!==null&&this.orderStartNumber<1){this.error.set('Order start number must be 1 or greater.');return;}if(this.orderPadding!==null&&this.orderPadding<1){this.error.set('Order padding must be 1 or greater.');return;}if(this.fullPrepaymentDiscountPercent<0||this.fullPrepaymentDiscountPercent>25){this.error.set('Full prepayment discount must be between 0% and 25%.');return;}this.saving.set(true);this.error.set(null);this.success.set(null);try{await Promise.all([firstValueFrom(this.http.patch(`${this.apiBase}/shops/${shopId}`,{settings:{pos:{orders:{prefix:this.orderPrefix.trim()||null,startNumber:this.orderStartNumber,padding:this.orderPadding,defaultFulfillmentStatus:this.defaultFulfillmentStatus}}}})),firstValueFrom(this.http.patch(`${this.apiBase}/booking-payments/settings`,{adminDepositEnforcement:this.adminDepositEnforcement,fullPrepaymentEnabled:this.fullPrepaymentEnabled,fullPrepaymentDiscountPercent:this.fullPrepaymentEnabled?this.fullPrepaymentDiscountPercent:0}))]);this.success.set('Payment settings updated.');await this.load();}catch(e){console.error(e);this.error.set('Payment settings could not be saved.');}finally{this.saving.set(false);}}
}
