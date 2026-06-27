import { Pipe, PipeTransform } from '@angular/core';

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  const dateOnly = new Date(`${value}T00:00:00`);
  return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
}

export function formatTime12(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const [hourText, minuteText = '00'] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }

  const period = hour >= 12 ? 'م' : 'ص';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

@Pipe({
  name: 'appTime12',
  standalone: true
})
export class AppTime12Pipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatTime12(value);
  }
}

@Pipe({
  name: 'appDate',
  standalone: true
})
export class AppDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const date = toDate(value);
    if (!date) {
      return value ?? '';
    }

    return new Intl.DateTimeFormat('ar-EG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }
}

@Pipe({
  name: 'appDateTime',
  standalone: true
})
export class AppDateTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const date = toDate(value);
    if (!date) {
      return value ?? '';
    }

    return new Intl.DateTimeFormat('ar-EG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }
}
