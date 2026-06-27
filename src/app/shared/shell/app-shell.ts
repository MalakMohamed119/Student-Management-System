import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/api.models';

function cleanDisplayName(value: string): string {
  return value
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/^[\s،,.\u200e\u200f]+/, '')
    .trim();
}

type NavItem = {
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
};

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss'
})
export class AppShell {
  readonly auth = inject(AuthService);
  readonly displayName = computed(() => {
    const user = this.auth.user();
    const name = cleanDisplayName(user?.fullName || user?.username || '');
    return name || user?.username || '';
  });

  readonly navItems = computed(() => {
    const role = this.auth.user()?.role;
    const items: NavItem[] = [
      { label: 'إدارة المالك', path: '/owner', icon: '◆', roles: ['Owner'] },
      { label: 'لوحة التشغيل', path: '/dashboard', icon: '▣', roles: ['Admin'] },
      { label: 'الطلاب', path: '/students', icon: '◉', roles: ['Owner', 'Admin'] },
      { label: 'المجموعات', path: '/groups', icon: '▦', roles: ['Admin'] },
      { label: 'الحضور والغياب', path: '/attendance', icon: '✓', roles: ['Admin'] },
      { label: 'حسابي', path: '/settings', icon: '⚙', roles: ['Owner', 'Admin'] }
    ];

    return items.filter((item) => Boolean(role && item.roles.includes(role)));
  });
}
