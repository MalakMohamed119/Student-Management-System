import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly messages = signal<ToastMessage[]>([]);

  success(text: string) {
    this.show(text, 'success');
  }

  error(text: string) {
    this.show(text, 'error');
  }

  info(text: string) {
    this.show(text, 'info');
  }

  dismiss(id: number) {
    this.messages.update((messages) => messages.filter((message) => message.id !== id));
  }

  private show(text: string, type: ToastType) {
    const id = this.nextId++;
    this.messages.update((messages) => [...messages, { id, text, type }]);
    window.setTimeout(() => this.dismiss(id), 3200);
  }
}
