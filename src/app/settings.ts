import { Component } from '@angular/core';

@Component({
  selector: 'botica-admin-settings',
  template: `
    <section class="page-intro"><h1>Configuración</h1><p>Consulta los valores de ejemplo del panel administrativo.</p>
      <div class="demo-notice"><strong>Demostración.</strong> Valores de solo lectura.</div>
    </section>
    <section class="card settings-card" aria-labelledby="preferences">
      <h2 id="preferences">Preferencias generales</h2>
      <label>Nombre comercial<input type="text" value="Botica Ya" readonly></label>
      <label>Idioma<input type="text" value="Español" readonly></label>
      <label>Moneda<input type="text" value="Sol peruano (PEN)" readonly></label>
      <label>Dominio administrativo propuesto<input type="text" value="admin.boticaya.com" readonly></label>
    </section>
  `,
})
export class SettingsPage {}
