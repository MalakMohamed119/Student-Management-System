export type UserRole = 'Owner' | 'Admin';
export type StudentStatus = 'active' | 'expelled';
export type Gender = 'Male' | 'Female';

export interface AuthUser {
  id?: number;
  accessToken: string;
  refreshToken: string;
  username: string;
  role: UserRole;
  isFirstLogin: boolean;
  fullName: string;
  phone: string;
  imageUrl?: string;
}

export interface GroupDay {
  id: number;
  groupId: number;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface StudentGroup {
  id: number;
  name: string;
  description: string;
  studentCount: number;
  groupDays: GroupDay[];
}

export interface Student {
  id: number;
  name: string;
  studentPhone: string;
  guardianPhone: string;
  gender: Gender;
  notes?: string;
  status?: StudentStatus;
  imageUrl?: string;
  consecutiveAbsences?: number;
  groupId?: number;
}

export interface Session {
  id: number;
  groupId: number;
  groupName?: string;
  sessionDate: string;
  startTime: string;
}

export interface AttendanceRow {
  studentId: number;
  studentName: string;
  isPresent: boolean | null;
  status?: StudentStatus;
}

export interface SystemSettings {
  absenceThreshold: number;
}

export interface AuditLog {
  id: number;
  username: string;
  action: string;
  entityType: string;
  entityId?: number;
  createdAt: string;
}
