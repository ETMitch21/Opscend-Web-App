import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login-component/login-component';
import { PublicGuard } from './core/auth/public.guard';
import { DashboardComponent } from './features/dashboard/dashboard';
import { AuthGuard } from './core/auth/auth.guard';
import { ForgotComponent } from './features/auth/forgot-component/forgot-component';
import { ResetComponent } from './features/auth/reset-component/reset-component';
import { Repairs } from './features/repairs/repairs';
import { RepairsOverview } from './features/repairs/repairs-overview/repairs-overview';
import { CustomerComponent } from './features/customers/customers';
import { NewCustomer } from './features/customers/new-customer/new-customer';
import { EditCustomer } from './features/customers/edit-customer/edit-customer';
import { NewRepair } from './features/repairs/new-repair/new-repair';
import { RepairDetail } from './features/repairs/repair-detail/repair-detail';
import { MyAvailabilityComponent } from './features/settings/profile/my-availability/my-availability.component/my-availability.component';
import { MyProfileComponent } from './features/settings/profile/my-profile/my-profile.component';
import { ShopAvailability } from './features/settings/shop-availability/shop-availability';
import { ShopSettings } from './features/settings/shop-settings/shop-settings';
import { ShopUsers } from './features/settings/shop-users/shop-users';
import { SignupComponent } from './features/auth/signup-component/signup-component';
import { AcceptInviteComponent } from './features/auth/accept-invite-component/accept-invite-component';

export const routes: Routes = [
    { path: "signup", component: SignupComponent, canActivate: [PublicGuard] },
    { path: "accept-invite", component: AcceptInviteComponent, canActivate: [PublicGuard] },
    { path: "login", component: LoginComponent, canActivate: [PublicGuard] },
    { path: "forgot", component: ForgotComponent, canActivate: [PublicGuard] },
    { path: "reset", component: ResetComponent, canActivate: [PublicGuard] },
    { path: "dashboard", component: DashboardComponent, canActivate: [AuthGuard] },
    {
        path: 'settings',
        children: [
            {
                path: 'shop',
                children: [
                    {
                        path: 'general',
                        component: ShopSettings
                    },
                    {
                        path: 'users',
                        component: ShopUsers
                    },
                    {
                        path: 'availability',
                        component: ShopAvailability
                    },
                    {
                        path: '',
                        redirectTo: 'general',
                        pathMatch: 'full'
                    }
                ]
            },
            {
                path: 'profile',
                children: [
                    {
                        path: 'my-profile',
                        component: MyProfileComponent
                    },
                    {
                        path: 'my-availability',
                        component: MyAvailabilityComponent
                    },
                    {
                        path: '',
                        redirectTo: 'my-profile',
                        pathMatch: 'full'
                    }
                ]
            },
            {
                path: 'integrations',
                loadComponent: () => import("./features/settings/shop-integrations/shop-integrations").then(
                    (m) => m.ShopIntegrations
                ),
            }
        ],
        canActivate: [AuthGuard]
    },
    {
        path: 'repairs',
        component: Repairs,
        children: [
            {
                path: 'overview',
                component: RepairsOverview
            },
            {
                path: 'create',
                component: NewRepair
            },
            {
                path: 'detail/:id',
                component: RepairDetail
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'overview'
            }
        ],
        canActivate: [AuthGuard]
    },
    {
        path: 'customers',
        children: [
            {
                path: 'overview',
                component: CustomerComponent
            },
            {
                path: 'create',
                component: NewCustomer
            },
            {
                path: ':id/edit',
                component: EditCustomer
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'overview'
            }
        ],
        canActivate: [AuthGuard]
    },
    { path: "", redirectTo: "dashboard", pathMatch: "full" }
];
