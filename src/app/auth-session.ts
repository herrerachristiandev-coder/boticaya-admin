import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AdminUser { id: string; email: string; fullName: string; roles: string[] }
function readUser(value: unknown): AdminUser {
  const user = (value as { user?: Partial<AdminUser> } | null)?.user;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string' || typeof user.fullName !== 'string'
    || !Array.isArray(user.roles) || user.roles.some(role => typeof role !== 'string')
    || !user.roles.some(role => role === 'administrator' || role === 'pharmacist')) throw new Error('Invalid session');
  return { id: user.id, email: user.email, fullName: user.fullName, roles: user.roles };
}

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly http = inject(HttpClient);
  readonly user = signal<AdminUser | null>(null);
  readonly error = signal('');
  private restoration: Promise<AdminUser | null> | undefined;
  private locallyClosed = false;
  lock(): void {
    this.locallyClosed = true;
    this.user.set(null);
  }
  async restore(): Promise<AdminUser | null> {
    if (this.locallyClosed) return null;
    if (!this.restoration) this.restoration = firstValueFrom(this.http.get<unknown>('/api/admin/v1/session', { timeout: 12000 }))
      .then(value => { if (this.locallyClosed) return null; const user = readUser(value); this.user.set(user); return user; })
      .catch(() => { this.user.set(null); return null; })
      .finally(() => { this.restoration = undefined; });
    return this.restoration;
  }
  async login(email: string, password: string): Promise<void> {
    this.error.set('');
    try {
      const result = await firstValueFrom(this.http.post<unknown>('/api/admin/v1/session/login', { email, password },
        { headers: { 'X-Botica-Request': 'admin' } }));
      const user = readUser(result);
      this.locallyClosed = false;
      this.user.set(user);
    } catch (error) {
      this.user.set(null);
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.error.set(status === 401 ? 'Correo o contraseña incorrectos.' : status === 403 ? 'Tu cuenta no tiene acceso administrativo.'
        : status === 429 ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' : 'No se pudo iniciar sesión. Revisa la conexión e inténtalo nuevamente.');
      throw error;
    }
  }
  async logout(): Promise<void> {
    this.error.set('');
    try {
      await firstValueFrom(this.http.post('/api/admin/v1/session/logout', {}, { timeout: 5000, headers: { 'X-Botica-Request': 'admin' } }));
      this.lock();
    } catch (error) { this.error.set('No se pudo cerrar la sesión. Inténtalo nuevamente.'); throw error; }
  }
}
