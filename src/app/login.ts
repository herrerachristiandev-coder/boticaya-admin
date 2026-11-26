import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSession } from './auth-session';

@Component({
  selector: 'botica-admin-login',
  template: `
    <main class="login">
      <div class="login-card">
        <div class="brand"><span class="brand-mark" aria-hidden="true">+</span><span>Botica Ya<small>Administración</small></span></div>
        <div class="login-body">
          <span class="demo-label">Acceso del equipo</span>
          <h1>Acceso administrativo</h1>
          <p>Ingresa con tu cuenta autorizada para administrar la botica.</p>
          <form #form (submit)="submit($event, form)">
            <fieldset [disabled]="loading()">
              <legend>Tu cuenta</legend>
              <label for="admin-email">Correo electrónico</label>
              <input #emailInput id="admin-email" name="email" type="email" required maxlength="254" autocomplete="username" [value]="email()" (input)="email.set(emailInput.value)">
              <label for="admin-password" class="login-password-label">Contraseña</label>
              <input #passwordInput id="admin-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="current-password" [value]="password()" (input)="password.set(passwordInput.value)">
            </fieldset>
            @if (session.error()) { <p class="form-error" role="alert">{{ session.error() }}</p> }
            <button type="submit" class="primary-button login-submit" [disabled]="loading()" [attr.aria-busy]="loading()">{{ loading() ? 'Ingresando…' : 'Iniciar sesión' }}</button>
          </form>
          <p class="login-note">Solo las cuentas autorizadas pueden acceder al panel.</p>
        </div>
      </div>
    </main>
  `,
})
export class LoginPage {
  protected readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  async submit(event: Event, form: HTMLFormElement): Promise<void> {
    event.preventDefault();
    if (this.loading() || !form.reportValidity()) return;
    this.loading.set(true);
    try {
      await this.session.login(this.email().trim().toLowerCase(), this.password());
      this.password.set('');
      const target = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login') ? target : '/dashboard');
    } catch { this.password.set(''); }
    finally { this.loading.set(false); }
  }
}
