import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AttendanceRow, Session, Student } from '../../core/models/api.models';
import { AppDatePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';

@Component({
  selector: 'app-session-attendance',
  imports: [RouterLink, AppDatePipe, AppTime12Pipe],
  templateUrl: './session-attendance.html',
  styleUrl: './attendance.scss'
})
export class SessionAttendancePage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly sessionId = Number(this.route.snapshot.paramMap.get('id'));
  readonly groupId = Number(this.route.snapshot.queryParamMap.get('groupId') ?? 0);
  readonly sessions = signal<Session[]>([]);
  readonly attendance = signal<AttendanceRow[]>([]);
  readonly loading = signal(true);
  readonly message = signal('جاري تحميل كشف الحضور...');
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.getUpcomingSessions().subscribe((sessions) => {
      this.sessions.set(sessions);
      if (this.selectedSessionDetails() || this.groupId) {
        this.openSheet();
        return;
      }

      this.api.getSession(this.sessionId).subscribe({
        next: (session) => {
          this.sessions.set([session, ...sessions]);
          this.openSheet();
        },
        error: () => this.openSheet()
      });
    });
  }

  mark(row: AttendanceRow, isPresent: boolean) {
    this.api.markAttendance(this.sessionId, row.studentId, isPresent).subscribe({
      next: () => {
        this.attendance.update((rows) =>
          rows.map((item) => (item.studentId === row.studentId ? { ...item, isPresent } : item))
        );
      },
      error: () => this.error.set('تعذر تسجيل الحضور. جربي مرة أخرى.')
    });
  }

  selectedSessionDetails() {
    return this.sessions().find((session) => session.id === this.sessionId) ?? null;
  }

  private openSheet() {
    this.attendance.set([]);
    this.loading.set(true);
    this.message.set('جاري تحميل كشف الحضور...');

    this.api.getSessionAttendance(this.sessionId).subscribe({
      next: (rows) => {
        if (rows.length > 0) {
          this.attendance.set(rows);
          this.message.set('');
          this.loading.set(false);
          return;
        }

        this.loadGroupStudentsForSession();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل كشف الحضور.');
        this.message.set('');
      }
    });
  }

  private loadGroupStudentsForSession() {
    const session = this.selectedSessionDetails();
    const groupId = session?.groupId || this.groupId;

    if (!groupId) {
      this.loading.set(false);
      this.message.set('الحصة غير موجودة.');
      return;
    }

    this.api.getGroupStudents(groupId).subscribe({
      next: (students) => {
        this.attendance.set(students.map((student) => this.toAttendanceRow(student)));
        this.message.set(students.length ? '' : 'المجموعة دي مفيهاش طلاب لسه.');
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل طلبة المجموعة.');
      }
    });
  }

  private toAttendanceRow(student: Student): AttendanceRow {
    return {
      studentId: student.id,
      studentName: student.name,
      isPresent: null,
      status: student.status
    };
  }
}
