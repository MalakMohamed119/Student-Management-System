import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/api.models';

const STORAGE_KEY = 'student-management.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/api/Auth`;
  private readonly userState = signal<AuthUser | null>(this.readStoredUser());

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => Boolean(this.userState()?.accessToken));
  readonly isOwner = computed(() => this.userState()?.role === 'Owner');
  readonly isAdmin = computed(() => this.userState()?.role === 'Admin');

  login(username: string, password: string, persistSession = true) {
    return this.http.post<AuthUser>(`${this.baseUrl}/login`, { username, password }).pipe(
      tap((user) => {
        if (persistSession) {
          this.persist(user);
        }
      })
    );
  }

  verifyPin(username: string, pin: string) {
    return this.http.post<AuthUser>(`${this.baseUrl}/verify-pin`, { username, pin }).pipe(
      tap((user) => this.persist(user))
    );
  }

  setupPin(pin: string) {
    return this.http.post(`${this.baseUrl}/setup-pin`, { pin });
  }

  updateProfile(payload: { fullName: string; phone: string }) {
    return this.http.put<AuthUser>(`${this.baseUrl}/profile`, payload).pipe(
      tap((user) => {
        const current = this.userState();
        this.persist({ ...(current ?? user), ...user });
      })
    );
  }

  registerAssistant(payload: { username: string; password: string; role: 'Admin'; fullName: string; phone: string }) {
    return this.http.post(`${this.baseUrl}/register`, payload);
  }

  getAssistants() {
    return this.http.get<AuthUser[]>(`${this.baseUrl}/assistants`);
  }

  resetPassword(userId: number, newPassword: string) {
    return this.http.post(`${this.baseUrl}/reset-password`, { userId, newPassword });
  }

  resetPin(userId: number, pin: string) {
    return this.http.post(`${this.baseUrl}/reset-pin`, { pin }, { params: { userId } });
  }

  refreshToken(accessToken: string, refreshToken: string) {
    const params = new HttpParams().set('accessToken', accessToken).set('refreshToken', refreshToken);
    return this.http.post<AuthUser>(`${this.baseUrl}/refresh`, null, { params }).pipe(tap((user) => this.persist(user)));
  }

  token() {
    return this.userState()?.accessToken ?? null;
  }

  homeUrl(role = this.userState()?.role) {
    return role === 'Owner' ? '/owner' : '/dashboard';
  }

  logout() {
    localStorage.removeItem(STORAGE_KEY);
    this.userState.set(null);
    this.router.navigateByUrl('/login');
  }

  persistSession(user: AuthUser) {
    this.persist(user);
  }

  private persist(user: AuthUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.userState.set(user);
  }

  private readStoredUser(): AuthUser | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value ? (JSON.parse(value) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
