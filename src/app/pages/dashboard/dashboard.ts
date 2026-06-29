import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Session, Student, StudentGroup } from '../../core/models/api.models';
import { AppDatePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [AppDatePipe, AppTime12Pipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly students = signal<Student[]>([]);
  readonly groups = signal<StudentGroup[]>([]);
  readonly sessions = signal<Session[]>([]);
  readonly groupActiveStudentCounts = signal<Record<number, number>>({});
  readonly loading = signal(true);
  readonly error = signal('');
  readonly expelledStudents = computed(() => this.students().filter((student) => student.status === 'expelled'));

  constructor() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      students: this.api.getStudents(),
      groups: this.api.getGroups(),
      sessions: this.api.getUpcomingSessions()
    }).pipe(
      switchMap(({ students, groups, sessions }) => {
        if (!groups.length) {
          return of({ students, groups, sessions, counts: {} as Record<number, number> });
        }

        return forkJoin(
          groups.map((group) =>
            this.api.getGroupStudents(group.id).pipe(catchError(() => of([] as Student[])))
          )
        ).pipe(
          switchMap((groupStudents) => {
            const counts = groups.reduce<Record<number, number>>((result, group, index) => {
              result[group.id] = groupStudents[index].filter((student) => student.status !== 'expelled').length;
              return result;
            }, {});
            return of({ students, groups, sessions, counts });
          })
        );
      })
    ).subscribe({
      next: ({ students, groups, sessions, counts }) => {
        this.students.set(students);
        this.groups.set(groups);
        this.sessions.set(sessions);
        this.groupActiveStudentCounts.set(counts);
      },
      complete: () => this.loading.set(false),
      error: () => {
        this.error.set('\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645.');
        this.loading.set(false);
      }
    });
  }

  expelledCount() {
    return this.expelledStudents().length;
  }

  activeStudentCount(groupId: number) {
    return this.groupActiveStudentCounts()[groupId] ?? this.groups().find((group) => group.id === groupId)?.studentCount ?? 0;
  }
}
