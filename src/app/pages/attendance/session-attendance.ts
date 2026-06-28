import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AttendanceRow, Session, Student } from '../../core/models/api.models';
import { catchError, forkJoin, of } from 'rxjs';
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
  private readonly toast = inject(ToastService);

  readonly sessionId = Number(this.route.snapshot.paramMap.get('id'));
  readonly groupId = Number(this.route.snapshot.queryParamMap.get('groupId') ?? 0);
  readonly sessions = signal<Session[]>([]);
  readonly attendance = signal<AttendanceRow[]>([]);
  readonly savingStudentIds = signal<number[]>([]);
  readonly loading = signal(true);
  readonly message = signal('جاري تحميل كشف الحضور...');
  readonly error = signal('');
  readonly presentCount = computed(() => this.attendance().filter((row) => row.isPresent === true).length);
  readonly absentCount = computed(() => this.attendance().filter((row) => row.isPresent === false).length);
  readonly totalCount = computed(() => this.attendance().length);

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
    if (this.isSaving(row.studentId)) {
      return;
    }

    this.savingStudentIds.update((ids) => [...ids, row.studentId]);
    this.error.set('');

    this.api.markAttendance(this.sessionId, row.studentId, isPresent).subscribe({
      next: () => {
        this.toast.success(isPresent ? 'تم تسجيل الطالب حاضر.' : 'تم تسجيل الطالب غائب.');
        this.openSheet(false, row.studentId);
      },
      error: () => {
        this.error.set('تعذر تسجيل الحضور. جرب مرة أخرى.');
        this.toast.error('تعذر تسجيل الحضور.');
        this.finishSaving(row.studentId);
      }
    });
  }

  isSaving(studentId: number) {
    return this.savingStudentIds().includes(studentId);
  }

  selectedSessionDetails() {
    return this.sessions().find((session) => session.id === this.sessionId) ?? null;
  }

  private openSheet(showLoading = true, savedStudentId?: number) {
    if (showLoading) {
      this.attendance.set([]);
      this.loading.set(true);
      this.message.set('جاري تحميل كشف الحضور...');
    }

    const session = this.selectedSessionDetails();
    const groupId = session?.groupId || this.groupId;

    if (!groupId) {
      this.loadAttendanceOnly(savedStudentId);
      return;
    }

    forkJoin({
      rows: this.api.getSessionAttendance(this.sessionId).pipe(catchError(() => of([] as AttendanceRow[]))),
      students: this.api.getGroupStudents(groupId).pipe(catchError(() => of([] as Student[])))
    }).subscribe({
      next: ({ rows, students }) => {
        this.attendance.set(this.mergeAttendanceRows(students, rows));
        this.message.set(students.length || rows.length ? '' : 'المجموعة دي مفيهاش طلاب لسه.');
        this.loading.set(false);
        this.finishSaving(savedStudentId);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل كشف الحضور.');
        this.message.set('');
        this.toast.error('تعذر تحميل كشف الحضور.');
        this.finishSaving(savedStudentId);
      }
    });
  }

  private loadAttendanceOnly(savedStudentId?: number) {
    this.api.getSessionAttendance(this.sessionId).subscribe({
      next: (rows) => {
        this.attendance.set(rows);
        this.message.set(rows.length ? '' : 'الحصة غير موجودة.');
        this.loading.set(false);
        this.finishSaving(savedStudentId);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل كشف الحضور.');
        this.message.set('');
        this.toast.error('تعذر تحميل كشف الحضور.');
        this.finishSaving(savedStudentId);
      }
    });
  }

  private mergeAttendanceRows(students: Student[], rows: AttendanceRow[]) {
    const rowsByStudent = new Map(rows.map((row) => [row.studentId, row]));
    const studentRows = students.map((student) => ({
      ...this.toAttendanceRow(student),
      ...(rowsByStudent.get(student.id) ?? {})
    }));
    const existingIds = new Set(students.map((student) => student.id));
    const extraRows = rows.filter((row) => !existingIds.has(row.studentId));

    return [...studentRows, ...extraRows];
  }

  private finishSaving(studentId: number | undefined) {
    if (!studentId) {
      return;
    }

    this.savingStudentIds.update((ids) => ids.filter((id) => id !== studentId));
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
