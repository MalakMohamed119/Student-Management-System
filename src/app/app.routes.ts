import { Routes } from '@angular/router';
import { adminGuard, adminOrOwnerGuard, authGuard, ownerGuard, roleHomeGuard } from './core/guards/auth.guard';
import { AppShell } from './shared/shell/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage)
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [roleHomeGuard], children: [] },
      {
        path: 'dashboard',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage)
      },
      {
        path: 'students',
        canActivate: [adminOrOwnerGuard],
        loadComponent: () => import('./pages/students/students').then((m) => m.StudentsPage)
      },
      {
        path: 'groups',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/groups/groups').then((m) => m.GroupsPage)
      },
      {
        path: 'attendance',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/attendance/attendance').then((m) => m.AttendancePage)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPage)
      },
      { path: 'setup-pin', loadComponent: () => import('./pages/pin-setup/pin-setup').then((m) => m.PinSetupPage) },
      {
        path: 'owner',
        canActivate: [ownerGuard],
        loadComponent: () => import('./pages/owner/owner').then((m) => m.OwnerPage)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
