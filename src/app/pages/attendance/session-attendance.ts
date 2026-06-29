import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AttendanceRow, Session, Student } from '../../core/models/api.models';
import { catchError, forkJoin, of } from 'rxjs';
import { AppDatePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';

type AttendanceApiRow = AttendanceRow & {
  StudentId?: number;
  StudentName?: string;
  Name?: string;
  IsPresent?: boolean | string | number | null;
  present?: boolean | string | number | null;
  Present?: boolean | string | number | null;
  attendanceStatus?: string | null;
  AttendanceStatus?: string | null;
  Status?: string;
};

type StudentApiRow = Student & {
  Id?: number;
  Name?: string;
  Status?: string;
};

type AttendanceFilter = 'all' | 'present' | 'absent' | 'unmarked';

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
  readonly attendanceFilter = signal<AttendanceFilter>('all');
  readonly nameFilter = signal('');
  readonly localAttendance = signal<Record<number, boolean>>({});
  readonly savingStudentIds = signal<number[]>([]);
  readonly loading = signal(true);
  readonly message = signal('جاري تحميل كشف الحضور...');
  readonly error = signal('');
  readonly presentCount = computed(() => this.attendance().filter((row) => row.isPresent === true).length);
  readonly absentCount = computed(() => this.attendance().filter((row) => row.isPresent === false).length);
  readonly unmarkedCount = computed(() => this.attendance().filter((row) => row.isPresent === null).length);
  readonly totalCount = computed(() => this.attendance().length);
  readonly filteredAttendance = computed(() => {
    const filter = this.attendanceFilter();
    const search = this.nameFilter().trim().toLowerCase();

    return this.attendance().filter((row) => {
      const matchesStatus =
        filter === 'all' ||
        (filter === 'present' && row.isPresent === true) ||
        (filter === 'absent' && row.isPresent === false) ||
        (filter === 'unmarked' && row.isPresent === null);
      const matchesName = !search || row.studentName.toLowerCase().includes(search);

      return matchesStatus && matchesName;
    });
  });

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
        this.setLocalAttendance(row.studentId, isPresent);
        this.toast.success(isPresent ? 'تم تسجيل الطالب حاضر.' : 'تم تسجيل الطالب غائب.');
        this.openSheet(false, row.studentId);
      },
      error: () => {
        this.error.set('تعذر تسجيل الحضور. جرب مرة أخرى.');
        this.toast.error('تعذر تسجيل الحضور.');
        console.error('Attendance save failed', { sessionId: this.sessionId, studentId: row.studentId, isPresent });
        this.finishSaving(row.studentId);
      }
    });
  }

  isSaving(studentId: number) {
    return this.savingStudentIds().includes(studentId);
  }

  setAttendanceFilter(filter: AttendanceFilter) {
    this.attendanceFilter.set(filter);
  }

  setNameFilter(value: string) {
    this.nameFilter.set(value);
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
        this.attendance.set(this.applyLocalAttendance(this.mergeAttendanceRows(students, rows)));
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
        const normalizedRows = rows
          .map((row) => this.normalizeAttendanceRow(row as AttendanceApiRow))
          .filter((row) => row.status !== 'expelled');
        this.attendance.set(this.applyLocalAttendance(normalizedRows));
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
    const normalizedRows = rows.map((row) => this.normalizeAttendanceRow(row as AttendanceApiRow));
    const rowsByStudent = new Map(normalizedRows.map((row) => [row.studentId, row]));
    const activeStudents = students.filter((student) => this.studentStatus(student) !== 'expelled');
    const studentRows = activeStudents.map((student) => {
      const baseRow = this.toAttendanceRow(student);
      const apiRow = rowsByStudent.get(baseRow.studentId);

      return {
        ...baseRow,
        isPresent: apiRow?.isPresent ?? baseRow.isPresent,
        status: apiRow?.status ?? baseRow.status
      };
    });

    return studentRows;
  }

  private setLocalAttendance(studentId: number, isPresent: boolean) {
    this.localAttendance.update((current) => ({ ...current, [studentId]: isPresent }));
    this.attendance.update((rows) =>
      rows.map((row) => (row.studentId === studentId ? { ...row, isPresent } : row))
    );
  }

  private applyLocalAttendance(rows: AttendanceRow[]) {
    const local = this.localAttendance();
    return rows.map((row) =>
      Object.prototype.hasOwnProperty.call(local, row.studentId)
        ? { ...row, isPresent: local[row.studentId] }
        : row
    );
  }

  private finishSaving(studentId: number | undefined) {
    if (!studentId) {
      return;
    }

    this.savingStudentIds.update((ids) => ids.filter((id) => id !== studentId));
  }

  private toAttendanceRow(student: Student): AttendanceRow {
    return {
      studentId: this.studentId(student),
      studentName: this.studentName(student),
      isPresent: null,
      status: this.studentStatus(student)
    };
  }

  private normalizeAttendanceRow(row: AttendanceApiRow): AttendanceRow {
    const rawStatus = row.status ?? row.Status;

    return {
      studentId: Number(row.studentId ?? row.StudentId ?? 0),
      studentName: row.studentName ?? row.StudentName ?? row.Name ?? '',
      isPresent: this.toAttendanceValue(
        row.isPresent ??
          row.IsPresent ??
          row.present ??
          row.Present ??
          row.attendanceStatus ??
          row.AttendanceStatus ??
          rawStatus
      ),
      status: this.toStudentStatus(rawStatus)
    };
  }

  private studentId(student: Student) {
    const source = student as StudentApiRow;
    return Number(source.id ?? source.Id ?? 0);
  }

  private studentName(student: Student) {
    const source = student as StudentApiRow;
    return source.name ?? source.Name ?? '';
  }

  private studentStatus(student: Student) {
    const source = student as StudentApiRow;
    return this.toStudentStatus(source.status ?? source.Status);
  }

  private toStudentStatus(value: unknown): Student['status'] {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'active' || normalized === 'expelled' ? normalized : undefined;
  }

  private toAttendanceValue(value: boolean | string | number | null | undefined): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1 ? true : value === 0 ? false : null;
    }

    if (typeof value === 'string' && ['attended', 'yes'].includes(value.trim().toLowerCase())) {
      return true;
    }

    if (typeof value === 'string' && ['missed', 'no'].includes(value.trim().toLowerCase())) {
      return false;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'present', 'حاضر'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'absent', 'غائب'].includes(normalized)) {
        return false;
      }
    }

    return null;
  }
}
