import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login-component/login-component';
import { PublicGuard } from './core/auth/public.guard';
import { DashboardComponent } from './features/dashboard/dashboard';
import { AuthGuard } from './core/auth/auth.guard';
import { PermissionGuard } from './core/auth/permission.guard';
import { ForgotComponent } from './features/auth/forgot-component/forgot-component';
import { ResetComponent } from './features/auth/reset-component/reset-component';
import { Repairs } from './features/repairs/repairs';
import { RepairsOverview } from './features/repairs/repairs-overview/repairs-overview';
import { CustomerComponent } from './features/customers/customers';
import { NewCustomer } from './features/customers/new-customer/new-customer';
import { EditCustomer } from './features/customers/edit-customer/edit-customer';
import { NewRepair } from './features/repairs/new-repair/new-repair';
import { RepairDetail } from './features/repairs/repair-detail/repair-detail';
import { SignupComponent } from './features/auth/signup-component/signup-component';
import { AcceptInviteComponent } from './features/auth/accept-invite-component/accept-invite-component';
import { Products } from './features/products/products';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { RepairTracking } from './features/public/repair-tracking/repair-tracking';
import { Inventory } from './features/inventory/inventory';
import { PurchaseOrders } from './features/purchase-orders/purchase-orders';
import { PurchaseOrderDetail } from './features/purchase-orders/purchase-order-detail/purchase-order-detail';
import { Suppliers } from './features/suppliers/suppliers';
import { Contractors } from './features/contractors/contractors';
import { ContractorPayouts } from './features/contractor-payouts/contractor-payouts';
import { PublicBooking } from './features/public/public-booking/public-booking';
import { PublicQuoteApproval } from './features/public/public-quote-approval/public-quote-approval';
import { QuoteRequestsOverview } from './features/bookings/quote-requests/overview/quote-requests-overview';
import { QuoteRequestDetail } from './features/bookings/quote-requests/detail/quote-request-detail';
import { Services } from './features/services/services.component';
import { CommunicationsInbox } from './features/communications/communications-inbox';

export const routes: Routes = [
    {
        path: 'form/:token',
        loadComponent: () =>
            import('./features/public/form-completion/form-completion').then((m) => m.FormCompletion)
    },
    {
        path: 'portal/:shopSlug/verify',
        loadComponent: () =>
            import('./features/public/customer-portal/customer-portal').then((m) => m.CustomerPortal)
    },
    {
        path: 'portal/:shopSlug',
        loadComponent: () =>
            import('./features/public/customer-portal/customer-portal').then((m) => m.CustomerPortal)
    },
    {
        path: 'track/:token',
        component: RepairTracking
    },
    {
        path: 'quote/:token',
        component: PublicQuoteApproval
    },
    {
        path: 'book/:shopSlug',
        component: PublicBooking
    },
    { path: "signup", component: SignupComponent, canActivate: [PublicGuard] },
    { path: "accept-invite", component: AcceptInviteComponent, canActivate: [PublicGuard] },
    { path: "login", component: LoginComponent, canActivate: [PublicGuard] },
    { path: "forgot", component: ForgotComponent, canActivate: [PublicGuard] },
    { path: "reset", component: ResetComponent, canActivate: [PublicGuard] },
    { path: "dashboard", component: DashboardComponent, canActivate: [PermissionGuard], data: { permission: "repairs:read" } },
    {
        path: "balances",
        loadComponent: () =>
            import('./features/receivables/receivables').then((m) => m.Receivables),
        canActivate: [PermissionGuard],
        data: { permissions: ['orders:read', 'customers:read', 'repairs:read'] }
    },
    {
        path: "ai-assistant",
        loadComponent: () =>
            import('./features/ai-assistant/ai-assistant').then((m) => m.AiAssistant),
        canActivate: [PermissionGuard],
        data: { permission: 'ai:use' }
    },
    {
        path: "technician-dashboard",
        loadComponent: () =>
            import('./features/technician-dashboard/technician-dashboard').then((m) => m.TechnicianDashboard),
        canActivate: [PermissionGuard],
        data: { permission: 'technicianDashboard:read' }
    },
    {
        path: "knowledge-base",
        loadComponent: () =>
            import('./features/knowledge-base/knowledge-base').then((m) => m.KnowledgeBase),
        canActivate: [PermissionGuard],
        data: { permission: 'knowledge:read' }
    },
    {
        path: "analytics",
        loadComponent: () =>
            import('./features/analytics/analytics').then((m) => m.Analytics),
        canActivate: [PermissionGuard],
        data: { permission: 'analytics:read' }
    },
    {
        path: "payouts",
        redirectTo: "settings/shop/payouts",
        pathMatch: "full"
    },
    {
        path: "forms",
        loadComponent: () =>
            import('./features/forms/forms').then((m) => m.FormsPage),
        canActivate: [PermissionGuard],
        data: { permission: 'forms:read' }
    },
    {
        path: "automations",
        loadComponent: () =>
            import('./features/automations/automations').then((m) => m.Automations),
        canActivate: [PermissionGuard],
        data: { permission: 'automations:read' }
    },
    {
        path: "work-queue",
        loadComponent: () =>
            import('./features/work-queue/work-queue').then((m) => m.WorkQueue),
        canActivate: [PermissionGuard],
        data: { permission: 'workQueue:read' }
    },
    { path: "communications", component: CommunicationsInbox, canActivate: [PermissionGuard], data: { permission: 'communications:read' } },
    {
        path: 'settings',
        children: [
            {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                    import('./features/settings/settings-home/settings-home').then((m) => m.SettingsHome)
            },
            {
                path: 'shop',
                children: [
                    {
                        path: 'general',
                        loadComponent: () =>
                            import('./features/settings/shop-settings/shop-settings').then((m) => m.ShopSettings),
                        canActivate: [PermissionGuard],
                        data: { permission: 'shops:read' }
                    },
                    {
                        path: 'locations',
                        loadComponent: () =>
                            import('./features/settings/shop-locations/shop-locations').then((m) => m.ShopLocations),
                        canActivate: [PermissionGuard],
                        data: { permission: 'shops:create' }
                    },
                    {
                        path: 'users',
                        loadComponent: () =>
                            import('./features/settings/shop-users/shop-users').then((m) => m.ShopUsers),
                        canActivate: [PermissionGuard],
                        data: { permission: 'users:read' }
                    },
                    {
                        path: 'roles-permissions',
                        loadComponent: () =>
                            import('./features/settings/roles-permissions/roles-permissions').then((m) => m.RolesPermissions),
                        canActivate: [PermissionGuard],
                        data: { permission: 'roles:read' }
                    },
                    {
                        path: 'availability',
                        loadComponent: () =>
                            import('./features/settings/shop-availability/shop-availability').then((m) => m.ShopAvailability),
                        canActivate: [PermissionGuard],
                        data: { permission: 'availability:read' }
                    },
                    {
                        path: 'notifications',
                        loadComponent: () =>
                            import('./features/settings/repair-notifications/repair-notifications').then((m) => m.RepairNotifications),
                        canActivate: [PermissionGuard],
                        data: { permission: 'notifications:read' }
                    },
                    {
                        path: 'data-export',
                        loadComponent: () =>
                            import('./features/settings/data-export/data-export').then((m) => m.DataExportSettings),
                        canActivate: [PermissionGuard],
                        data: { permission: 'dataExport:read' }
                    },
                    {
                        path: 'system-health',
                        loadComponent: () =>
                            import('./features/settings/system-health/system-health').then((m) => m.SystemHealthSettings),
                        canActivate: [PermissionGuard],
                        data: { permission: 'systemHealth:read' }
                    },
                    {
                        path: 'shop-bookings',
                        loadComponent: () =>
                            import('./features/settings/shop-bookings/shop-bookings').then((m) => m.ShopBookingsComponent),
                        canActivate: [PermissionGuard],
                        data: { permission: 'booking:read' }
                    },
                    {
                        path: 'device-catalog',
                        loadComponent: () =>
                            import('./features/settings/device-catalog/device-catalog').then((m) => m.DeviceCatalogSettings),
                        canActivate: [PermissionGuard],
                        data: { permission: 'deviceCatalog:read' }
                    },
                    {
                        path: 'repair-pricing',
                        canActivate: [PermissionGuard],
                        data: { permission: 'repairPricing:read' },
                        children: [
                            {
                                path: 'types',
                                loadComponent: () =>
                                    import('./features/settings/repair-pricing-types/repair-pricing-types').then((m) => m.RepairPricingTypes)
                            },
                            {
                                path: 'new',
                                loadComponent: () =>
                                    import('./features/settings/repair-pricing-editor/repair-pricing-editor').then((m) => m.RepairPricingEditor),
                                canActivate: [PermissionGuard],
                                data: { permission: 'repairPricing:write' }
                            },
                            {
                                path: ':id',
                                loadComponent: () =>
                                    import('./features/settings/repair-pricing-editor/repair-pricing-editor').then((m) => m.RepairPricingEditor)
                            },
                            {
                                path: '',
                                pathMatch: 'full',
                                loadComponent: () =>
                                    import('./features/settings/repair-pricing/repair-pricing').then((m) => m.RepairPricingSettings)
                            }
                        ]
                    },
                    {
                        path: 'voice-agent',
                        loadComponent: () =>
                            import('./features/settings/voice-agent/voice-agent').then((m) => m.VoiceAgentSettingsComponent),
                        canActivate: [PermissionGuard],
                        data: { permission: 'voiceAgent:read' }
                    },
                    {
                        path: 'payouts',
                        loadComponent: () =>
                            import('./features/settings/payouts/payouts').then((m) => m.Payouts),
                        canActivate: [PermissionGuard],
                        data: { permission: 'payouts:write' }
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
                        loadComponent: () =>
                            import('./features/settings/profile/my-profile/my-profile.component').then((m) => m.MyProfileComponent)
                    },
                    {
                        path: 'my-availability',
                        loadComponent: () =>
                            import('./features/settings/profile/my-availability/my-availability.component/my-availability.component').then((m) => m.MyAvailabilityComponent),
                        canActivate: [PermissionGuard],
                        data: { permission: 'availability:read' }
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
                canActivate: [PermissionGuard],
                data: { permission: 'shops:read' }
            }
        ],
        canActivate: [AuthGuard]
    },
    {
        path: 'services',
        component: Services,
        canActivate: [PermissionGuard],
        data: { permission: 'services:read' }
    },
    {
        path: 'products',
        children: [
            {
                path: 'overview',
                component: Products,
                canActivate: [PermissionGuard],
                data: { permission: 'products:read' }
            },
            {
                path: 'detail/:id',
                component: ProductDetail,
                canActivate: [PermissionGuard],
                data: { permission: 'products:read' }
            },
            {
                path: 'inventory',
                component: Inventory,
                canActivate: [PermissionGuard],
                data: { permission: 'inventory:read' }
            },
            {
                path: 'inventory/purchase-orders',
                children: [
                    {
                        path: '',
                        component: PurchaseOrders,
                        canActivate: [PermissionGuard],
                        data: { permission: 'inventory:read' }
                    },
                    {
                        path: 'detail/:id',
                        component: PurchaseOrderDetail,
                        canActivate: [PermissionGuard],
                        data: { permission: 'inventory:read' }
                    }
                ]
            },
            {
                path: 'inventory/suppliers',
                component: Suppliers,
                canActivate: [PermissionGuard],
                data: { permission: 'inventory:read' }
            },
            {
                path: '',
                redirectTo: 'overview',
                pathMatch: 'full'
            }
        ]
    },
    {
        path: 'quote-requests',
        children: [
            {
                path: '',
                component: QuoteRequestsOverview
            },
            {
                path: ':id',
                component: QuoteRequestDetail
            }
        ],
        canActivate: [PermissionGuard],
        data: { permission: 'quotes:read' }
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
                component: NewRepair,
                canActivate: [PermissionGuard],
                data: { permission: 'repairs:write' }
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
        canActivate: [PermissionGuard],
        data: { permission: 'repairs:read' }
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
                component: NewCustomer,
                canActivate: [PermissionGuard],
                data: { permission: 'customers:write' }
            },
            {
                path: ':id/edit',
                redirectTo: ':id',
                pathMatch: 'full'
            },
            {
                path: ':id',
                component: EditCustomer
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'overview'
            }
        ],
        canActivate: [PermissionGuard],
        data: { permission: 'customers:read' }
    },
    {
        path: 'contractors',
        component: Contractors,
        canActivate: [PermissionGuard],
        data: { permission: 'contractors:read' }
    },
    {
        path: 'contractor-payouts',
        component: ContractorPayouts,
        canActivate: [PermissionGuard],
        data: { permission: 'contractorPayouts:read' }
    },
    { path: "", redirectTo: "dashboard", pathMatch: "full" }
];
