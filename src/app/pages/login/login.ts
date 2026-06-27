import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/api.models';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly accountType = signal<UserRole>('Owner');
  readonly showPassword = signal(false);
  readonly showPin = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    pin: ['']
  });

  canSubmit() {
    const { username, password, pin } = this.form.getRawValue();
    const hasPasswordLogin = username.trim().length > 0 && password.trim().length > 0;
    return this.accountType() === 'Owner'
      ? hasPasswordLogin && /^\d{4}$/.test(pin.trim())
      : hasPasswordLogin;
  }

  setAccountType(type: UserRole) {
    this.accountType.set(type);
    this.error.set('');
    this.showPin.set(false);
    this.form.patchValue({ pin: '' });
  }

  submit() {
    if (!this.canSubmit()) {
      this.error.set(this.accountType() === 'Owner'
        ? 'حساب المالك يحتاج اسم المستخدم وكلمة المرور وكود PIN من 4 أرقام.'
        : 'حساب الإداري يحتاج اسم المستخدم وكلمة المرور.');
      return;
    }

    this.error.set('');
    this.loading.set(true);
    const { username, password, pin } = this.form.getRawValue();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    const cleanPin = pin.trim();

    this.auth.login(cleanUsername, cleanPassword, false).pipe(
      switchMap((user) => {
        if (user.role !== this.accountType()) {
          this.error.set(this.accountType() === 'Owner'
            ? 'هذا الحساب ليس حساب مالك.'
            : 'هذا الحساب ليس حساب إداري.');
          this.loading.set(false);
          return EMPTY;
        }

        if (user.isFirstLogin) {
          this.auth.persistSession(user);
          this.router.navigateByUrl('/setup-pin');
          return EMPTY;
        }

        if (user.role === 'Admin') {
          this.auth.persistSession(user);
          this.router.navigateByUrl(this.auth.homeUrl(user.role));
          return EMPTY;
        }

        return this.auth.verifyPin(cleanUsername, cleanPin).pipe(
          tap((verifiedUser) => this.router.navigateByUrl(this.auth.homeUrl(verifiedUser.role)))
        );
      })
    ).subscribe({
      error: (error: HttpErrorResponse) => {
        const message = error.status === 401
          ? 'اسم المستخدم أو كلمة المرور أو كود PIN غير صحيح.'
          : 'الخادم غير متاح حاليًا. حاول مرة أخرى.';
        this.error.set(message);
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }
}
