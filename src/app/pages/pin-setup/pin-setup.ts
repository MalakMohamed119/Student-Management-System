import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-pin-setup',
  imports: [ReactiveFormsModule],
  templateUrl: './pin-setup.html',
  styleUrl: './pin-setup.scss'
})
export class PinSetupPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    pin: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
  });

  save() {
    if (this.form.invalid) {
      return;
    }
    this.auth.setupPin(this.form.getRawValue().pin).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeUrl()),
      error: () => this.error.set('تعذر حفظ كود PIN. حاول مرة أخرى.')
    });
  }
}
