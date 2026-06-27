import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AttendanceRow, Session, Student, StudentGroup } from '../../core/models/api.models';
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
  readonly groups = signal<StudentGroup[]>([]);
  readonly sessions = signal<Session[]>([]);
  readonly attendance = signal<AttendanceRow[]>([]);
  readonly selectedSession = signal<number | null>(null);
  readonly loadingSheet = signal(false);
  readonly sheetMessage = signal('اختاري حصة من القائمة عشان يظهر كشف الطلاب.');
  readonly sheetError = signal('');

  readonly form = this.fb.nonNullable.group({
    groupId: [0, Validators.required],
    sessionDate: ['', Validators.required],
    startTime: ['17:00', Validators.required]
  });

  constructor() {
    this.load();
    this.api.getGroups().subscribe((groups) => this.groups.set(groups));
  }

  load() {
    this.api.getUpcomingSessions().subscribe((sessions) => this.sessions.set(sessions));
  }

  createSession() {
    const value = this.form.getRawValue();
    if (!value.groupId || this.form.invalid) {
      return;
    }
    this.api.createSession(value).subscribe(() => this.load());
  }

  openSheet(sessionId: number) {
    this.selectedSession.set(sessionId);
    this.attendance.set([]);
    this.loadingSheet.set(true);
    this.sheetError.set('');
    this.sheetMessage.set('جاري تحميل كشف الحضور...');

    this.api.getSessionAttendance(sessionId).subscribe({
      next: (rows) => {
        if (rows.length > 0) {
          this.attendance.set(rows);
          this.sheetMessage.set('');
          this.loadingSheet.set(false);
          return;
        }

        this.loadGroupStudentsForSession(sessionId);
      },
      error: () => {
        this.loadingSheet.set(false);
        this.sheetError.set('تعذر تحميل كشف الحضور. جربي اختيار الحصة مرة تانية.');
        this.sheetMessage.set('');
      }
    });
  }

  mark(row: AttendanceRow, isPresent: boolean) {
    const sessionId = this.selectedSession();
    if (!sessionId) {
      return;
    }
    this.api.markAttendance(sessionId, row.studentId, isPresent).subscribe(() => this.openSheet(sessionId));
  }

  selectedSessionDetails() {
    const sessionId = this.selectedSession();
    return this.sessions().find((session) => session.id === sessionId) ?? null;
  }

  private loadGroupStudentsForSession(sessionId: number) {
    const session = this.sessions().find((item) => item.id === sessionId);
    if (!session) {
      this.loadingSheet.set(false);
      this.sheetMessage.set('اختاري حصة موجودة عشان يظهر كشف الطلاب.');
      return;
    }

    this.api.getGroupStudents(session.groupId).subscribe({
      next: (students) => {
        this.attendance.set(students.map((student) => this.toAttendanceRow(student)));
        this.sheetMessage.set(students.length ? '' : 'المجموعة دي مفيهاش طلاب لسه. ضيفي طلاب للمجموعة الأول.');
        this.loadingSheet.set(false);
      },
      error: () => {
        this.loadingSheet.set(false);
        this.sheetError.set('الحصة اتفتحت، بس تعذر تحميل طلبة المجموعة.');
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
