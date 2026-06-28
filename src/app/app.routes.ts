import { Routes } from '@angular/router';
import { adminGuard, adminOrOwnerGuard, authCanMatchGuard, ownerGuard } from './core/guards/auth.guard';
import { AppShell } from './shared/shell/app-shell';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage)
  },
  {
    path: '',
    component: AppShell,
    canMatch: [authCanMatchGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage)
      },

      {
        path: 'students/expelled',
        canActivate: [adminOrOwnerGuard],
        loadComponent: () => import('./pages/students/students').then((m) => m.StudentsPage)
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
        path: 'attendance/:id',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/attendance/session-attendance').then((m) => m.SessionAttendancePage)
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
  { path: '**', redirectTo: 'login' }
];
