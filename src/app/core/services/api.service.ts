import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AttendanceRow, AuditLog, Session, Student, StudentAttendanceRecord, StudentGroup, SystemSettings } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/api`;

  getStudents(status?: string) {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<Student[]>(`${this.api}/Students`, { params });
  }

  getStudent(id: number) {
    return this.http.get<Student>(`${this.api}/Students/${id}`);
  }

  searchStudents(query: string) {
    return this.http.get<Student[]>(`${this.api}/Students/search`, { params: { query } });
  }

  createStudent(payload: Partial<Student>) {
    return this.http.post<Student>(`${this.api}/Students`, payload);
  }

  updateStudent(id: number, payload: Partial<Student>) {
    return this.http.put<Student>(`${this.api}/Students/${id}`, payload);
  }

  deleteStudent(id: number) {
    return this.http.delete(`${this.api}/Students/${id}`);
  }

  expelStudent(id: number, reason: string) {
    return this.http.put(`${this.api}/Students/expel/${id}`, { reason });
  }

  activateStudent(id: number) {
    return this.http.put(`${this.api}/Students/activate/${id}`, {});
  }

  exportStudents() {
    return this.http.get(`${this.api}/Students/export`, { responseType: 'blob' });
  }

  importStudents(file: File) {
    const data = new FormData();
    data.append('file', file);
    return this.http.post(`${this.api}/Students/import`, data);
  }

  getGroups() {
    return this.http.get<StudentGroup[]>(`${this.api}/Groups`);
  }

  createGroup(payload: { name: string; description: string; weekdays: number[]; startTime: string; endTime: string }) {
    return this.http.post<StudentGroup>(`${this.api}/Groups`, payload);
  }

  updateGroup(id: number, payload: Partial<StudentGroup>) {
    return this.http.put<StudentGroup>(`${this.api}/Groups/${id}`, payload);
  }

  deleteGroup(id: number) {
    return this.http.delete(`${this.api}/Groups/${id}`);
  }

  enrollStudent(studentId: number, groupId: number) {
    return this.http.post(`${this.api}/Groups/enroll`, null, { params: { studentId, groupId } });
  }

  unenrollStudent(studentId: number, groupId: number) {
    return this.http.post(`${this.api}/Groups/unenroll`, null, { params: { studentId, groupId } });
  }

  getGroupStudents(groupId: number) {
    return this.http.get<Student[]>(`${this.api}/Groups/${groupId}/students`);
  }

  getStudentGroups(studentId: number) {
    return this.http.get<StudentGroup[]>(`${this.api}/Groups/student/${studentId}`);
  }

  getUpcomingSessions() {
    return this.http.get<Session[]>(`${this.api}/Sessions/upcoming`);
  }

  getSession(sessionId: number) {
    return this.http.get<Session>(`${this.api}/Sessions/${sessionId}`);
  }

  generateSessions(groupId: number, daysAhead = 14) {
    return this.http.post(`${this.api}/Sessions/generate`, null, { params: { groupId, daysAhead } });
  }

  createSession(payload: { groupId: number; sessionDate: string; startTime: string }) {
    return this.http.post<Session>(`${this.api}/Sessions`, payload);
  }

  getSessionAttendance(sessionId: number) {
    return this.http.get<AttendanceRow[]>(`${this.api}/Sessions/${sessionId}/attendance`);
  }

  getStudentAttendance(studentId: number) {
    return this.http.get<StudentAttendanceRecord[]>(`${this.api}/Sessions/student/${studentId}/attendance`);
  }

  markAttendance(sessionId: number, studentId: number, isPresent: boolean) {
    return this.http.post(`${this.api}/Sessions/attendance`, {
      sessionId,
      studentId,
      isPresent,
      SessionId: sessionId,
      StudentId: studentId,
      IsPresent: isPresent
    });
  }

  getSettings() {
    return this.http.get<SystemSettings>(`${this.api}/Settings`);
  }

  updateSettings(payload: SystemSettings) {
    return this.http.put<SystemSettings>(`${this.api}/Settings`, payload);
  }

  getLogs(username?: string) {
    const params = username ? new HttpParams().set('username', username) : undefined;
    return this.http.get<AuditLog[]>(`${this.api}/Logs`, { params });
  }

  getEntityLogs(entityType: string, entityId?: number) {
    let params = new HttpParams().set('entityType', entityType);
    if (entityId) {
      params = params.set('entityId', entityId);
    }
    return this.http.get<AuditLog[]>(`${this.api}/Logs/entity`, { params });
  }

  downloadBackup() {
    return this.http.get(`${this.api}/Backup/download`, { responseType: 'blob' });
  }

  restoreBackup(file: File) {
    const data = new FormData();
    data.append('file', file);
    return this.http.post(`${this.api}/Backup/restore`, data);
  }
}
