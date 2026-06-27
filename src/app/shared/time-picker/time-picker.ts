import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type Period = 'AM' | 'PM';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePicker),
      multi: true
    }
  ]
})
export class TimePicker implements ControlValueAccessor {
  readonly hours = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

  hour = 5;
  minute = '00';
  period: Period = 'PM';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    if (!value) {
      return;
    }

    const [hourText, minuteText = '00'] = value.split(':');
    const hour24 = Number(hourText);

    if (Number.isNaN(hour24)) {
      return;
    }

    this.period = hour24 >= 12 ? 'PM' : 'AM';
    this.hour = hour24 % 12 || 12;
    this.minute = String(Number(minuteText) || 0).padStart(2, '0');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  setHour(value: string) {
    this.hour = Number(value);
    this.emit();
  }

  setMinute(value: string) {
    this.minute = value;
    this.emit();
  }

  setPeriod(value: Period) {
    this.period = value;
    this.emit();
  }

  private emit() {
    let hour24 = this.hour % 12;
    if (this.period === 'PM') {
      hour24 += 12;
    }

    this.onTouched();
    this.onChange(`${String(hour24).padStart(2, '0')}:${this.minute}`);
  }
}
