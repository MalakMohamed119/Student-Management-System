import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Student, StudentGroup } from '../../core/models/api.models';
import { AppTime12Pipe } from '../../shared/date-time-format.pipe';
import { TimePicker } from '../../shared/time-picker/time-picker';

@Component({
  selector: 'app-groups',
  imports: [ReactiveFormsModule, AppTime12Pipe, TimePicker],
  templateUrl: './groups.html',
  styleUrl: './groups.scss'
})
export class GroupsPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly groups = signal<StudentGroup[]>([]);
  readonly students = signal<Student[]>([]);
  readonly weekdays = [
    { value: 1, label: 'الإثنين' },
    { value: 2, label: 'الثلاثاء' },
    { value: 3, label: 'الأربعاء' },
    { value: 4, label: 'الخميس' },
    { value: 5, label: 'الجمعة' },
    { value: 6, label: 'السبت' },
    { value: 7, label: 'الأحد' }
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    weekdays: [[1]],
    startTime: ['17:00', Validators.required],
    endTime: ['18:00', Validators.required]
  });

  constructor() {
    this.load();
  }

  load() {
    forkJoin({
      groups: this.api.getGroups(),
      students: this.api.getStudents()
    }).subscribe(({ groups, students }) => {
      this.groups.set(groups);
      this.students.set(students);
    });
  }

  setDay(day: number, checked: boolean) {
    const current = this.form.controls.weekdays.value;
    this.form.controls.weekdays.setValue(checked ? [...current, day] : current.filter((value) => value !== day));
  }

  save() {
    if (this.form.invalid || this.form.controls.weekdays.value.length === 0) {
      return;
    }
    this.api.createGroup(this.form.getRawValue()).subscribe({
      next: () => {
        this.toast.success('تم إنشاء المجموعة.');
        this.form.reset({ name: '', description: '', weekdays: [1], startTime: '17:00', endTime: '18:00' });
        this.load();
      },
      error: () => this.toast.error('تعذر إنشاء المجموعة.')
    });
  }

  activeStudentCount(groupId: number) {
    return this.students().filter((student) => student.groupId === groupId && student.status !== 'expelled').length;
  }

  openGroup(groupId: number) {
    this.router.navigate(['/groups', groupId]);
  }

  generate(groupId: number) {
    this.api.generateSessions(groupId, 30).subscribe({
      next: () => {
        this.toast.success('تم توليد حصص المجموعة.');
        this.load();
      },
      error: () => this.toast.error('تعذر توليد حصص المجموعة.')
    });
  }

  deleteGroup(group: StudentGroup) {
    if (!this.auth.isOwner()) {
      return;
    }

    this.api.deleteGroup(group.id).subscribe({
      next: () => {
        this.toast.success('تم حذف المجموعة.');
        this.load();
      },
      error: () => this.toast.error('تعذر حذف المجموعة.')
    });
  }
}
