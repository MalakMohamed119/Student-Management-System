import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Gender, Student, StudentGroup } from '../../core/models/api.models';

@Component({
  selector: 'app-students',
  imports: [ReactiveFormsModule],
  templateUrl: './students.html',
  styleUrl: './students.scss'
})
export class StudentsPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly students = signal<Student[]>([]);
  readonly groups = signal<StudentGroup[]>([]);
  readonly status = signal('');
  readonly editingStudentId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    studentPhone: ['', Validators.required],
    guardianPhone: ['', Validators.required],
    gender: ['Male' as Gender, Validators.required],
    groupId: [0],
    notes: ['']
  });

  constructor() {
    this.load();
    this.api.getGroups().subscribe((groups) => this.groups.set(groups));
  }

  load(status?: string) {
    this.status.set(status ?? '');
    this.api.getStudents(status).subscribe((students) => this.students.set(students));
  }

  search(query: string) {
    if (!query.trim()) {
      this.load(this.status());
      return;
    }
    this.api.searchStudents(query).subscribe((students) => this.students.set(students));
  }

  save() {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const payload = { ...value, groupId: value.groupId || undefined };
    const editingId = this.editingStudentId();
    const request = editingId ? this.api.updateStudent(editingId, payload) : this.api.createStudent(payload);

    request.subscribe(() => {
      this.resetForm();
      this.load(this.status());
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
      notes: student.notes ?? ''
    });
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
    const request =
      student.status === 'expelled'
        ? this.api.activateStudent(student.id)
        : this.api.expelStudent(student.id, 'تم الاستبعاد من لوحة التحكم');
    request.subscribe(() => this.load(this.status()));
  }

  deleteStudent(student: Student) {
    if (!this.auth.isOwner()) {
      return;
    }

    this.api.deleteStudent(student.id).subscribe(() => this.load(this.status()));
  }

  export() {
    this.api.exportStudents().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'students.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  private resetForm() {
    this.editingStudentId.set(null);
    this.form.reset({ name: '', studentPhone: '', guardianPhone: '', gender: 'Male', groupId: 0, notes: '' });
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
