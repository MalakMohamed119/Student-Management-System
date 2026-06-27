import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { AuditLog, AuthUser, Session, Student, StudentGroup, SystemSettings } from '../../core/models/api.models';
import { AppDatePipe, AppDateTimePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';

type OwnerSection = 'overview' | 'admins' | 'system' | 'logs';

@Component({
  selector: 'app-owner',
  imports: [ReactiveFormsModule, AppDatePipe, AppDateTimePipe, AppTime12Pipe],
  templateUrl: './owner.html',
  styleUrls: ['./owner.scss']
})
export class OwnerPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly settings = signal<SystemSettings | null>(null);
  readonly logs = signal<AuditLog[]>([]);
  readonly assistants = signal<AuthUser[]>([]);
  readonly students = signal<Student[]>([]);
  readonly groups = signal<StudentGroup[]>([]);
  readonly sessions = signal<Session[]>([]);

  readonly loading = signal(true);
  readonly message = signal('');
  readonly error = signal('');
  readonly activeSection = signal<OwnerSection>('overview');

  readonly settingsForm = this.fb.nonNullable.group({
    absenceThreshold: [3, [Validators.required, Validators.min(1)]]
  });

  readonly assistantForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    username: ['', Validators.required],
    phone: ['', Validators.required],
    password: ['', Validators.required]
  });

  readonly passwordForm = this.fb.nonNullable.group({
    userId: [0, Validators.required],
    newPassword: ['', Validators.required]
  });

  readonly pinForm = this.fb.nonNullable.group({
    userId: [0, Validators.required],
    pin: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
  });

  readonly nearestSessions = computed(() =>
    this.sessions()
      .slice()
      .sort((a, b) => new Date(`${a.sessionDate}T${a.startTime}`).getTime() - new Date(`${b.sessionDate}T${b.startTime}`).getTime())
      .slice(0, 6)
  );

  readonly largestGroups = computed(() =>
    this.groups()
      .slice()
      .sort((a, b) => (b.studentCount ?? 0) - (a.studentCount ?? 0))
  );

  readonly recentLogs = computed(() => this.logs().slice(0, 12));

  constructor() {
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      settings: this.api.getSettings(),
      logs: this.api.getLogs(),
      assistants: this.auth.getAssistants(),
      students: this.api.getStudents(),
      groups: this.api.getGroups(),
      sessions: this.api.getUpcomingSessions()
    }).subscribe({
      next: ({ settings, logs, assistants, students, groups, sessions }) => {
        this.settings.set(settings);
        this.logs.set(logs);
        this.assistants.set(assistants);
        this.students.set(students);
        this.groups.set(groups);
        this.sessions.set(sessions);
        this.settingsForm.patchValue(settings);
      },
      error: () => this.error.set('تعذر تحميل بيانات المالك. تأكدي من تسجيل الدخول بحساب Owner.'),
      complete: () => this.loading.set(false)
    });
  }

  expelledCount() {
    return this.students().filter((student) => student.status === 'expelled').length;
  }

  setSection(section: OwnerSection) {
    this.activeSection.set(section);
  }

  saveSettings() {
    if (this.settingsForm.invalid) {
      return;
    }

    this.api.updateSettings(this.settingsForm.getRawValue()).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.showMessage('تم حفظ إعدادات النظام.');
      },
      error: () => this.error.set('تعذر حفظ الإعدادات.')
    });
  }

  createAssistant() {
    if (this.assistantForm.invalid) {
      this.error.set('اكتبي بيانات الإداري كاملة.');
      return;
    }

    this.auth.registerAssistant({ ...this.assistantForm.getRawValue(), role: 'Admin' }).subscribe({
      next: () => {
        this.assistantForm.reset({ fullName: '', username: '', phone: '', password: '' });
        this.showMessage('تم إنشاء حساب الإداري.');
        this.refreshAssistants();
      },
      error: () => this.error.set('تعذر إنشاء حساب الإداري. تأكدي من الصلاحيات أو اسم المستخدم.')
    });
  }

  resetPassword() {
    if (this.passwordForm.invalid || !this.passwordForm.controls.userId.value) {
      this.error.set('اختاري الإداري واكتبي كلمة مرور جديدة.');
      return;
    }

    const value = this.passwordForm.getRawValue();
    this.auth.resetPassword(value.userId, value.newPassword).subscribe({
      next: () => {
        this.passwordForm.reset({ userId: 0, newPassword: '' });
        this.showMessage('تم تغيير كلمة مرور الإداري.');
      },
      error: () => this.error.set('تعذر تغيير كلمة المرور.')
    });
  }

  resetPin() {
    if (this.pinForm.invalid || !this.pinForm.controls.userId.value) {
      this.error.set('اختاري الإداري واكتبي PIN من 4 أرقام.');
      return;
    }

    const value = this.pinForm.getRawValue();
    this.auth.resetPin(value.userId, value.pin).subscribe({
      next: () => {
        this.pinForm.reset({ userId: 0, pin: '' });
        this.showMessage('تم تغيير PIN الإداري.');
      },
      error: () => this.error.set('تعذر تغيير PIN.')
    });
  }

  downloadBackup() {
    this.api.downloadBackup().subscribe({
      next: async (blob) => {
        const rawBackup = await blob.text();
        let backupText = rawBackup;

        try {
          backupText = JSON.stringify(JSON.parse(rawBackup), null, 2);
        } catch {
          backupText = rawBackup;
        }

        const readableBackup = new Blob([backupText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(readableBackup);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `student-management-backup-${new Date().toISOString().slice(0, 10)}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('تعذر تحميل النسخة الاحتياطية.')
    });
  }

  restoreBackup(file: File | null | undefined) {
    if (!file) {
      return;
    }

    this.api.restoreBackup(file).subscribe({
      next: () => {
        this.showMessage('تم استرجاع النسخة الاحتياطية.');
        this.refresh();
      },
      error: () => this.error.set('تعذر استرجاع النسخة الاحتياطية.')
    });
  }

  private refreshAssistants() {
    this.auth.getAssistants().subscribe((assistants) => this.assistants.set(assistants));
  }

  private showMessage(value: string) {
    this.error.set('');
    this.message.set(value);
    setTimeout(() => this.message.set(''), 2500);
  }
}
