import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

function cleanName(value: string): string {
  return value
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/^[\s،,.\u200e\u200f]+/, '')
    .trim();
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsPage {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly saved = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    fullName: [cleanName(this.auth.user()?.fullName ?? ''), Validators.required],
    phone: [this.auth.user()?.phone ?? '', Validators.required]
  });

  readonly displayName = computed(() => {
    const formName = cleanName(this.form.controls.fullName.value);
    const username = cleanName(this.auth.user()?.username ?? '');
    return formName || username;
  });

  save() {
    if (this.form.invalid) {
      this.error.set('اكتب بيانات الحساب كاملة.');
      return;
    }

    const value = this.form.getRawValue();
    const payload = { fullName: cleanName(value.fullName), phone: value.phone };
    this.form.controls.fullName.setValue(payload.fullName);

    this.auth.updateProfile(payload).subscribe({
      next: () => this.showSaved('تم حفظ بيانات الحساب.'),
      error: () => this.error.set('تعذر حفظ بيانات الحساب.')
    });
  }

  fallbackInitial() {
    return this.displayName().slice(0, 1) || 'A';
  }

  roleLabel() {
    return this.auth.user()?.role === 'Owner' ? 'مالك النظام' : 'إداري';
  }

  private showSaved(value: string) {
    this.error.set('');
    this.saved.set(value);
    setTimeout(() => this.saved.set(''), 2500);
  }
}
