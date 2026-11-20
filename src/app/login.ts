import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'botica-admin-login',
  imports: [RouterLink],
  template: `
    <main class="login">
      <div class="login-card">
        <div class="brand"><span class="brand-mark" aria-hidden="true">+</span><span>Botica Ya<small>Administración</small></span></div>
        <div class="login-body">
          <span class="demo-label">Demostración</span>
          <h1>Acceso administrativo</h1>
          <p>Vista previa del panel para administradores y trabajadores.</p>
          <fieldset>
            <legend>Cuenta de muestra</legend>
            <label for="demo-account">Correo de demostración</label>
            <input id="demo-account" type="email" value="equipo@example.invalid" readonly autocomplete="off">
          </fieldset>
          <a class="primary-button" routerLink="/dashboard">Entrar a la demostración</a>
          <p class="login-note">El acceso es de demostración. No solicita credenciales ni inicia una sesión real.</p>
        </div>
      </div>
    </main>
  `,
})
export class LoginPage {}
