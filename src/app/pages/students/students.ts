import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditLog, Gender, Student, StudentAttendanceRecord, StudentGroup } from '../../core/models/api.models';
import { AppDatePipe, AppTime12Pipe } from '../../shared/date-time-format.pipe';

const EXPULSION_REASONS_KEY = 'student-management.expulsion-reasons';

@Component({
  selector: 'app-students',
  imports: [ReactiveFormsModule, RouterLink, AppDatePipe, AppTime12Pipe],
  templateUrl: './students.html',
  styleUrl: './students.scss'
})
export class StudentsPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly students = signal<Student[]>([]);
  readonly groups = signal<StudentGroup[]>([]);
  readonly status = signal('');
  readonly groupFilter = signal(0);
  readonly editingStudentId = signal<number | null>(null);
  readonly selectedStudent = signal<Student | null>(null);
  readonly selectedStudentGroups = signal<StudentGroup[]>([]);
  readonly selectedStudentAttendance = signal<StudentAttendanceRecord[]>([]);
  readonly selectedStudentLogs = signal<AuditLog[]>([]);
  readonly selectedStudentReasons = signal<string[]>([]);
  readonly expelTarget = signal<Student | null>(null);
  readonly expelReason = signal('');
  readonly transferTarget = signal<Student | null>(null);
  readonly transferGroupId = signal(0);
  readonly isExpelledPage = signal(this.route.snapshot.routeConfig?.path === 'students/expelled');
  readonly expelledAbsenceCounts = signal<Record<number, number>>({});
  readonly detailsLoading = signal(false);
  readonly error = signal('');

  readonly presentDays = computed(() => this.selectedStudentAttendance().filter((item) => item.isPresent).length);
  readonly absentDays = computed(() => this.selectedStudentAttendance().filter((item) => !item.isPresent).length);
  readonly absentAttendanceRecords = computed(() =>
    this.selectedStudentAttendance()
      .filter((item) => !item.isPresent)
      .sort((a, b) => this.attendanceRecordTime(b) - this.attendanceRecordTime(a))
  );
  readonly selectedGroupNames = computed(() => this.selectedStudentGroups().map((group) => group.name).join('، '));
  readonly expelReasons = computed(() => {
    const student = this.selectedStudent();
    const apiReasons = student ? this.expulsionReasonsFromStudent(student) : [];
    if (apiReasons.length) {
      return apiReasons;
    }

    return this.selectedStudentReasons().length ? this.selectedStudentReasons() : this.readReasonFallback(this.selectedStudentLogs());
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    studentPhone: ['', Validators.required],
    guardianPhone: ['', Validators.required],
    gender: ['Male' as Gender, Validators.required],
    groupId: [0],
    notes: ['']
  });

  constructor() {
    this.load(this.isExpelledPage() ? 'expelled' : undefined);
    this.api.getGroups().subscribe((groups) => this.groups.set(groups));
  }

  load(status?: string) {
    this.status.set(status ?? '');
    this.loadStudents();
  }

  search(query: string) {
    if (!query.trim()) {
      this.loadStudents();
      return;
    }

    this.api.searchStudents(query).subscribe((students) => {
      const groupId = this.groupFilter();
      const status = this.status();
      this.setStudents(
        students.filter((student) => (!status || student.status === status) && (!groupId || student.groupId === groupId))
      );
    });
  }

  filterByGroup(value: string) {
    this.groupFilter.set(Number(value));
    this.loadStudents();
  }

  save() {
    if (this.form.invalid) {
      this.error.set('اكتب بيانات الطالب كاملة.');
      return;
    }

    const value = this.form.getRawValue();
    const editingId = this.editingStudentId();
    const previousGroupId = editingId ? this.students().find((student) => student.id === editingId)?.groupId ?? 0 : 0;
    const nextGroupId = value.groupId || 0;
    const payload = { ...value, notes: this.cleanStudentNotes(value.notes), groupId: nextGroupId || undefined, imageUrl: undefined };
    const request = editingId ? this.api.updateStudent(editingId, payload) : this.api.createStudent(payload);

    request.subscribe({
      next: (student) => this.syncStudentGroup(student.id || editingId, previousGroupId, nextGroupId),
      error: () => {
        this.error.set('تعذر حفظ بيانات الطالب.');
        this.toast.error('تعذر حفظ بيانات الطالب.');
      }
    });
  }

  editStudent(student: Student) {
    this.editingStudentId.set(student.id);
    this.form.reset({
      name: student.name,
      studentPhone: student.studentPhone,
      guardianPhone: student.guardianPhone,
      gender: student.gender,
      groupId: student.groupId ?? 0,
      notes: this.cleanStudentNotes(student.notes)
    });
  }

  openTransfer(student: Student) {
    this.transferTarget.set(student);
    this.transferGroupId.set(student.groupId ?? 0);
  }

  closeTransfer() {
    this.transferTarget.set(null);
    this.transferGroupId.set(0);
  }

  transferStudent() {
    const student = this.transferTarget();
    const nextGroupId = this.transferGroupId();
    const previousGroupId = student?.groupId ?? 0;

    if (!student) {
      return;
    }

    if (previousGroupId === nextGroupId) {
      this.error.set('اختار مجموعة مختلفة لنقل الطالب.');
      return;
    }

    this.moveStudentBetweenGroups(student.id, previousGroupId, nextGroupId);
  }

  cancelEdit() {
    this.resetForm();
  }

  groupName(groupId: number | undefined) {
    if (!groupId) {
      return 'بدون مجموعة';
    }

    return this.groups().find((group) => group.id === groupId)?.name ?? `مجموعة رقم ${groupId}`;
  }

  whatsappUrl(phone: string | null | undefined) {
    const number = this.whatsappNumber(phone);
    return number ? `https://wa.me/${number}` : '';
  }

  toggleStatus(student: Student) {
    if (student.status === 'expelled') {
      this.api.activateStudent(student.id).subscribe({
        next: () => {
          this.toast.success('تم تفعيل الطالب.');
          this.loadStudents();
        },
        error: () => this.toast.error('تعذر تفعيل الطالب.')
      });
      return;
    }

    this.expelTarget.set(student);
    this.expelReason.set('');
  }

  confirmExpel() {
    const student = this.expelTarget();
    const reason = this.expelReason().trim();
    if (!student || !reason) {
      this.error.set('اكتب سبب الاستبعاد الأول.');
      return;
    }

    this.api.expelStudent(student.id, reason).subscribe({
      next: () => {
        this.saveExpulsionReason(student.id, reason);
        this.toast.success('تم استبعاد الطالب.');
        this.removeExpelledStudentFromGroup(student);
      },
      error: () => {
        this.error.set('تعذر استبعاد الطالب.');
        this.toast.error('تعذر استبعاد الطالب.');
      }
    });
  }

  closeExpel() {
    this.expelTarget.set(null);
    this.expelReason.set('');
  }

  openStudent(student: Student) {
    this.detailsLoading.set(true);
    this.selectedStudent.set(student);
    this.selectedStudentGroups.set([]);
    this.selectedStudentAttendance.set([]);
    this.selectedStudentLogs.set([]);
    this.selectedStudentReasons.set(this.readExpulsionReasons(student.id));

    forkJoin({
      student: this.api.getStudent(student.id).pipe(catchError(() => of(student))),
      groups: this.api.getStudentGroups(student.id).pipe(catchError(() => of([] as StudentGroup[]))),
      attendance: this.api.getStudentAttendance(student.id).pipe(catchError(() => of([] as StudentAttendanceRecord[]))),
      logs: this.api.getEntityLogs('student', student.id).pipe(catchError(() => of([] as AuditLog[])))
    }).subscribe(({ student, groups, attendance, logs }) => {
      this.selectedStudent.set(student);
      this.selectedStudentGroups.set(groups);
      this.selectedStudentAttendance.set(attendance);
      this.selectedStudentLogs.set(logs);
      this.selectedStudentReasons.set(this.readExpulsionReasons(student.id));
      this.detailsLoading.set(false);
    });
  }

  closeStudentDetails() {
    this.selectedStudent.set(null);
  }

  expulsionReasons(student: Student) {
    const apiReasons = this.expulsionReasonsFromStudent(student);
    return apiReasons.length ? apiReasons : this.readExpulsionReasons(student.id);
  }

  studentNotes(student: Student) {
    return this.cleanStudentNotes(student.notes);
  }

  absenceDaysFor(student: Student) {
    return this.expelledAbsenceCounts()[student.id] ?? student.consecutiveAbsences ?? 0;
  }

  deleteStudent(student: Student) {
    if (!this.auth.isOwner()) {
      return;
    }

    this.api.deleteStudent(student.id).subscribe({
      next: () => {
        this.toast.success('تم حذف الطالب.');
        this.loadStudents();
      },
      error: () => this.toast.error('تعذر حذف الطالب.')
    });
  }

  export() {
    this.api.exportStudents().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'students.xlsx';
        anchor.click();
        URL.revokeObjectURL(url);
        this.toast.success('تم تصدير الطلاب.');
      },
      error: () => this.toast.error('تعذر تصدير الطلاب.')
    });
  }

  private loadStudents() {
    const groupId = this.groupFilter();
    const status = this.status();
    const request = groupId ? this.api.getGroupStudents(groupId) : this.api.getStudents(status || undefined);

    request.subscribe((students) => {
      this.setStudents(groupId && status ? students.filter((student) => student.status === status) : students);
    });
  }

  private setStudents(students: Student[]) {
    this.students.set(students);

    if (this.isExpelledPage()) {
      this.loadExpelledAbsenceCounts(students);
    }
  }

  private loadExpelledAbsenceCounts(students: Student[]) {
    const expelled = students.filter((student) => student.status === 'expelled');
    if (!expelled.length) {
      this.expelledAbsenceCounts.set({});
      return;
    }

    forkJoin(
      expelled.map((student) =>
        this.api.getStudentAttendance(student.id).pipe(catchError(() => of([] as StudentAttendanceRecord[])))
      )
    ).subscribe((recordsList) => {
      const counts = expelled.reduce<Record<number, number>>((result, student, index) => {
        result[student.id] = recordsList[index].filter((record) => !record.isPresent).length;
        return result;
      }, {});
      this.expelledAbsenceCounts.set(counts);
    });
  }

  private syncStudentGroup(studentId: number | null, previousGroupId: number, nextGroupId: number) {
    if (!studentId || previousGroupId === nextGroupId) {
      this.finishSave();
      return;
    }

    if (previousGroupId && nextGroupId) {
      this.api.unenrollStudent(studentId, previousGroupId).subscribe({
        next: () => this.api.enrollStudent(studentId, nextGroupId).subscribe({ next: () => this.finishSave(), error: () => this.finishSave() }),
        error: () => this.api.enrollStudent(studentId, nextGroupId).subscribe({ next: () => this.finishSave(), error: () => this.finishSave() })
      });
      return;
    }

    if (previousGroupId) {
      this.api.unenrollStudent(studentId, previousGroupId).subscribe({ next: () => this.finishSave(), error: () => this.finishSave() });
      return;
    }

    this.api.enrollStudent(studentId, nextGroupId).subscribe({ next: () => this.finishSave(), error: () => this.finishSave() });
  }

  private finishSave() {
    this.toast.success(this.editingStudentId() ? 'تم تعديل بيانات الطالب.' : 'تم حفظ الطالب.');
    this.resetForm();
    this.loadStudents();
  }

  private moveStudentBetweenGroups(studentId: number, previousGroupId: number, nextGroupId: number) {
    const finish = () => {
      this.closeTransfer();
      this.error.set('');
      this.toast.success('تم نقل الطالب.');
      this.loadStudents();
    };

    if (previousGroupId && nextGroupId) {
      this.api.unenrollStudent(studentId, previousGroupId).subscribe({
        next: () => this.api.enrollStudent(studentId, nextGroupId).subscribe({ next: finish, error: finish }),
        error: () => this.api.enrollStudent(studentId, nextGroupId).subscribe({ next: finish, error: finish })
      });
      return;
    }

    if (previousGroupId) {
      this.api.unenrollStudent(studentId, previousGroupId).subscribe({
        next: finish,
        error: () => {
          this.error.set('تعذر نقل الطالب.');
          this.toast.error('تعذر نقل الطالب.');
        }
      });
      return;
    }

    if (nextGroupId) {
      this.api.enrollStudent(studentId, nextGroupId).subscribe({
        next: finish,
        error: () => {
          this.error.set('تعذر نقل الطالب.');
          this.toast.error('تعذر نقل الطالب.');
        }
      });
      return;
    }

    finish();
  }

  private removeExpelledStudentFromGroup(student: Student) {
    const finish = () => {
      this.closeExpel();
      this.loadStudents();
      this.api.getGroups().subscribe((groups) => this.groups.set(groups));
    };

    if (!student.groupId) {
      finish();
      return;
    }

    this.api.unenrollStudent(student.id, student.groupId).subscribe({
      next: finish,
      error: finish
    });
  }

  private resetForm() {
    this.editingStudentId.set(null);
    this.form.reset({ name: '', studentPhone: '', guardianPhone: '', gender: 'Male', groupId: 0, notes: '' });
  }

  private saveExpulsionReason(studentId: number, reason: string) {
    const allReasons = this.readAllExpulsionReasons();
    allReasons[studentId] = [...(allReasons[studentId] ?? []), reason];
    localStorage.setItem(EXPULSION_REASONS_KEY, JSON.stringify(allReasons));
  }

  private readExpulsionReasons(studentId: number) {
    return this.readAllExpulsionReasons()[studentId] ?? [];
  }

  private expulsionReasonsFromStudent(student: Student) {
    const source = student as Student & {
      expulsionReason?: string;
      expulsionReasons?: string[];
      expelledReason?: string;
      expelReason?: string;
      dismissalReason?: string;
    };
    const reasons = [
      source.expulsionReason,
      source.expelledReason,
      source.expelReason,
      source.dismissalReason,
      ...(source.expulsionReasons ?? []),
      ...this.expulsionReasonsFromNotes(student.notes)
    ];

    return [...new Set(reasons.filter((reason): reason is string => Boolean(reason?.trim())).map((reason) => reason.trim()))];
  }

  private readAllExpulsionReasons(): Record<number, string[]> {
    try {
      return JSON.parse(localStorage.getItem(EXPULSION_REASONS_KEY) ?? '{}') as Record<number, string[]>;
    } catch {
      return {};
    }
  }

  private readReasonFallback(logs: AuditLog[]) {
    return logs
      .filter((log) => /expel|استبعاد|طرد/i.test(log.action))
      .map((log) => this.cleanExpulsionReason(log.action))
      .filter((reason) => reason && reason.toLowerCase() !== 'expel');
  }

  private cleanExpulsionReason(value: string) {
    return value
      .replace(/expel/gi, '')
      .replace(/استبعاد|طرد/gi, '')
      .replace(/^[\s:،,\-.]+|[\s:،,\-.]+$/g, '')
      .trim();
  }

  private expulsionReasonsFromNotes(notes: string | null | undefined) {
    if (!notes) {
      return [];
    }

    const reasons: string[] = [];
    const bracketPattern = /\[(?:[^\]]*(?:طرد|استبعاد|expel)[^\]]*(?:السبب|reason)\s*[:：-]\s*)([^\]]+)\]/gi;
    let match: RegExpExecArray | null;

    while ((match = bracketPattern.exec(notes)) !== null) {
      reasons.push(match[1].trim());
    }

    return reasons;
  }

  private cleanStudentNotes(notes: string | null | undefined) {
    if (!notes) {
      return '';
    }

    return notes
      .replace(/\s*\[(?:[^\]]*(?:طرد|استبعاد|expel)[^\]]*(?:السبب|reason)\s*[:：-]\s*)[^\]]+\]\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private attendanceRecordTime(record: StudentAttendanceRecord) {
    return new Date(`${record.sessionDate ?? ''} ${record.startTime ?? ''}`).getTime() || 0;
  }

  private whatsappNumber(phone: string | null | undefined) {
    if (!phone) {
      return '';
    }

    let value = phone.replace(/[^\d+]/g, '');
    if (value.startsWith('+')) {
      value = value.slice(1);
    }
    if (value.startsWith('00')) {
      value = value.slice(2);
    }
    if (value.startsWith('0')) {
      value = `20${value.slice(1)}`;
    }
    if (/^1[0125]\d{8}$/.test(value)) {
      value = `20${value}`;
    }

    return /^\d{10,15}$/.test(value) ? value : '';
  }
}
