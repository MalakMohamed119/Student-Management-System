import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { Session, StudentGroup } from '../../core/models/api.models';
import { AppDatePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';
import { TimePicker } from '../../shared/time-picker/time-picker';

@Component({
  selector: 'app-attendance',
  imports: [ReactiveFormsModule, AppDatePipe, AppTime12Pipe, TimePicker],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss'
})
export class AttendancePage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly groups = signal<StudentGroup[]>([]);
  readonly sessions = signal<Session[]>([]);
  readonly groupFilter = signal(0);

  readonly filteredSessions = computed(() => {
    const groupId = this.groupFilter();
    return groupId ? this.sessions().filter((session) => session.groupId === groupId) : this.sessions();
  });

  readonly form = this.fb.nonNullable.group({
    groupId: [0, Validators.required],
    sessionDate: [this.today(), Validators.required],
    startTime: ['17:00', Validators.required]
  });

  constructor() {
    this.load();
    this.api.getGroups().subscribe((groups) => this.groups.set(groups));
  }

  load() {
    this.api.getUpcomingSessions().subscribe((sessions) => this.sessions.set(sessions));
  }

  filterByGroup(value: string) {
    this.groupFilter.set(Number(value));
  }

  createSession() {
    const value = this.form.getRawValue();
    if (!value.groupId || this.form.invalid) {
      return;
    }

    this.api.createSession(value).subscribe({
      next: () => {
        this.toast.success('تم إنشاء الحصة.');
        this.form.reset({ groupId: 0, sessionDate: this.today(), startTime: '17:00' });
        this.load();
      },
      error: () => this.toast.error('تعذر إنشاء الحصة.')
    });
  }

  openSheet(sessionId: number) {
    const session = this.sessions().find((item) => item.id === sessionId);
    this.router.navigate(['/attendance', sessionId], { queryParams: { groupId: session?.groupId ?? 0 } });
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}
