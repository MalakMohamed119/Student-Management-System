import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AttendanceRow, Session, Student, StudentGroup } from '../../core/models/api.models';
import { AppDatePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';

interface SessionSummary {
  session: Session;
  present: number;
  absent: number;
  total: number;
}

type AttendanceApiRow = AttendanceRow & {
  IsPresent?: boolean | string | number | null;
  present?: boolean | string | number | null;
  Present?: boolean | string | number | null;
  attendanceStatus?: string | null;
  AttendanceStatus?: string | null;
};

@Component({
  selector: 'app-group-sessions',
  imports: [RouterLink, AppDatePipe, AppTime12Pipe],
  templateUrl: './group-sessions.html',
  styleUrl: './group-sessions.scss'
})
export class GroupSessionsPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly groupId = Number(this.route.snapshot.paramMap.get('id'));
  readonly group = signal<StudentGroup | null>(null);
  readonly students = signal<Student[]>([]);
  readonly sessionSummaries = signal<SessionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly activeStudents = computed(() => this.students().filter((student) => student.status !== 'expelled'));
  readonly expelledStudents = computed(() => this.students().filter((student) => student.status === 'expelled'));

  constructor() {
    this.load();
  }

  @HostListener('window:focus')
  refreshOnFocus() {
    this.load();
  }

  @HostListener('window:pageshow')
  refreshOnPageShow() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      groups: this.api.getGroups().pipe(catchError(() => of([] as StudentGroup[]))),
      students: this.api.getGroupStudents(this.groupId).pipe(catchError(() => of([] as Student[]))),
      sessions: this.api.getUpcomingSessions().pipe(catchError(() => of([] as Session[])))
    }).subscribe(({ groups, students, sessions }) => {
      this.group.set(groups.find((group) => group.id === this.groupId) ?? null);
      this.students.set(students);
      this.loadSessionSummaries(sessions.filter((session) => session.groupId === this.groupId));
    });
  }

  private loadSessionSummaries(sessions: Session[]) {
    const sortedSessions = [...sessions].sort((a, b) => this.sessionTime(a) - this.sessionTime(b));

    if (!sortedSessions.length) {
      this.sessionSummaries.set([]);
      this.loading.set(false);
      return;
    }

    forkJoin(
      sortedSessions.map((session) =>
        this.api.getSessionAttendance(session.id).pipe(catchError(() => of([] as AttendanceRow[])))
      )
    ).subscribe({
      next: (attendanceSheets) => {
        this.sessionSummaries.set(
          sortedSessions.map((session, index) => this.toSessionSummary(session, attendanceSheets[index]))
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('تعذر تحميل إحصائيات حصص المجموعة.');
        this.toast.error('تعذر تحميل إحصائيات حصص المجموعة.');
        this.loading.set(false);
      }
    });
  }

  private toSessionSummary(session: Session, rows: AttendanceRow[]): SessionSummary {
    return {
      session,
      present: rows.filter((row) => this.toAttendanceValue(row as AttendanceApiRow) === true).length,
      absent: rows.filter((row) => this.toAttendanceValue(row as AttendanceApiRow) === false).length,
      total: Math.max(rows.length, this.students().length)
    };
  }

  private sessionTime(session: Session) {
    return new Date(`${session.sessionDate} ${session.startTime ?? ''}`).getTime() || 0;
  }

  private toAttendanceValue(row: AttendanceApiRow): boolean | null {
    const source = row as unknown as Record<string, unknown>;
    const value = source['isPresent'] ?? source['IsPresent'] ?? source['present'] ?? source['Present'] ?? source['attendanceStatus'] ?? source['AttendanceStatus'];

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1 ? true : value === 0 ? false : null;
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
