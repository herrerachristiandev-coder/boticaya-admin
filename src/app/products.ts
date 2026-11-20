import { Component, computed, inject, signal } from '@angular/core';
import { DemoInventory } from './inventory-data';

@Component({
  selector: 'botica-admin-products',
  template: `
    <section class="page-intro"><h1>Productos</h1><p>Consulta las referencias del catálogo.</p>
      <div class="demo-notice"><strong>Datos de demostración.</strong> Catálogo de muestra.</div>
    </section>
    <details class="card demo-editor" [open]="editorOpen()" (toggle)="editorOpen.set(productEditor.open)" #productEditor>
      <summary>Nuevo producto</summary>
      <form #editor (submit)="save($event, editor)">
        <label>Nombre<input #name name="name" required maxlength="100" [value]="draft().name" (input)="updateDraft('name', name.value)"></label>
        <label>SKU<input #sku name="sku" required maxlength="32" [value]="draft().sku" (input)="updateDraft('sku', sku.value)"></label>
        <div class="editor-field">
          <div class="field-label">
            <label for="product-presentation">Presentación</label>
            <span class="field-help" (mouseenter)="activeHelp.set('presentation')" (mouseleave)="closeHelp('presentation')">
              <button type="button" class="field-info" aria-label="Ayuda sobre Presentación" aria-describedby="presentation-help"
                (click)="activeHelp.set('presentation')" (blur)="closeHelp('presentation')" (keydown.escape)="closeHelp('presentation')">i</button>
              <span id="presentation-help" class="field-tooltip" role="tooltip" [hidden]="activeHelp() !== 'presentation'">Indica el envase y el contenido, por ejemplo, caja de 20 unidades o frasco de 120 ml.</span>
            </span>
          </div>
          <input id="product-presentation" #presentation name="presentation" required maxlength="80" [value]="draft().presentation"
            (input)="updateDraft('presentation', presentation.value)" aria-describedby="presentation-help">
        </div>
        <div class="editor-field">
          <div class="field-label">
            <label for="product-category">Categoría</label>
            <span class="field-help" (mouseenter)="activeHelp.set('category')" (mouseleave)="closeHelp('category')">
              <button type="button" class="field-info" aria-label="Ayuda sobre Categoría" aria-describedby="category-help"
                (click)="activeHelp.set('category')" (blur)="closeHelp('category')" (keydown.escape)="closeHelp('category')">i</button>
              <span id="category-help" class="field-tooltip" role="tooltip" [hidden]="activeHelp() !== 'category'">Elige el grupo del catálogo donde se mostrará el producto.</span>
            </span>
          </div>
          <select id="product-category" #category name="category" required [value]="draft().category"
            (change)="updateDraft('category', category.value)" aria-describedby="category-help">
            <option value="" disabled>Selecciona una categoría</option>
            <option>Medicamentos</option><option>Cuidado personal</option><option>Curación</option>
            <option>Vitaminas y suplementos</option><option>Otros</option>
          </select>
        </div>
        <label>Precio de venta (S/)<input #price name="price" type="number" min="0.01" step="0.01" placeholder="0,00"
          required [value]="draft().price" (input)="updateDraft('price', price.value)"></label>
        <button type="submit" class="primary-button">Crear producto de muestra</button>
      </form>
    </details>
    <p class="demo-feedback" role="status">{{ feedback() }}</p>
    <section class="card" aria-label="Catálogo">
      <div class="module-filters"><label>Nombre o SKU
        <input #search type="search" (input)="query.set(search.value)">
      </label></div>
      <table><thead><tr><th scope="col">Producto</th><th scope="col">SKU</th><th scope="col">Disponibilidad</th></tr></thead>
        <tbody>
          @for (product of visibleProducts(); track product.sku) {
            <tr><th scope="row">{{ product.name }}
              @if (product.presentation) { <small>{{ product.presentation }} · {{ product.category }} · S/ {{ product.price }}</small> }
            </th><td>{{ product.sku }}</td><td>{{ product.state }}</td></tr>
          } @empty { <tr><td colspan="3">No hay productos que coincidan.</td></tr> }
        </tbody>
      </table>
    </section>
  `,
})
export class ProductsPage {
  private readonly inventory = inject(DemoInventory);
  protected readonly draft = this.inventory.productDraft;
  protected readonly editorOpen = signal(Object.values(this.draft()).some(Boolean));
  protected readonly activeHelp = signal<'presentation' | 'category' | null>(null);

  protected closeHelp(field: 'presentation' | 'category'): void {
    if (this.activeHelp() === field) this.activeHelp.set(null);
  }
  protected readonly feedback = signal('');
  protected readonly query = signal('');
  protected readonly visibleProducts = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.inventory.products().filter(product =>
      product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query),
    );
  });

  protected save(event: Event, form: HTMLFormElement): void {
    event.preventDefault();
    const fields = new FormData(form);
    const error = this.inventory.addProduct({
      name: String(fields.get('name') ?? ''), sku: String(fields.get('sku') ?? ''),
      presentation: String(fields.get('presentation') ?? ''), category: String(fields.get('category') ?? ''),
      price: Number(fields.get('price')),
    });
    this.feedback.set(error || `Producto «${String(fields.get('name')).trim()}» creado en la demo. Puedes registrar su primera entrada en Inventario.`);
    if (!error) {
      this.draft.set({ name: '', sku: '', presentation: '', category: '', price: '' });
      form.reset();
    }
  }

  protected updateDraft(field: keyof ReturnType<typeof this.draft>, value: string): void {
    this.draft.update(current => ({ ...current, [field]: value }));
  }
}
