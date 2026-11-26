import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApi } from './admin-api';
import { AuthSession } from './auth-session';
import { CatalogProduct, CatalogStore, priceMinor } from './catalog-store';

interface ProductImage {
  id: string; bucket: string; storage_path: string; alt_text: string | null; mime_type: string;
}
interface ProductDetail extends Omit<CatalogProduct, 'category_id'> {
  category_id: string | null;
  description: string | null; brand_id: string | null; version: number; requires_prescription: boolean;
  images: ProductImage[];
  presentations: { id: string; sku: string; factor_base_units: string; price_cents: string }[];
}

@Component({
  selector: 'botica-admin-product-detail',
  imports: [RouterLink],
  template: `
    <section class="page-intro"><h1>Ficha de producto</h1><a routerLink="/productos">Volver a Productos</a></section>
    @if (loading()) { <div class="skeleton" role="status" aria-label="Cargando ficha"></div> }
    @else if (error()) { <p class="notice" role="alert">{{ error() }} <button type="button" (click)="load()">Reintentar</button></p> }
    @else if (product(); as item) {
      <section class="card section-panel">
        <h2>{{ item.name }}</h2>
        <p>{{ item.sku }} · {{ item.category }} · {{ item.brand || 'Sin marca' }} · {{ item.status }}</p>
        <p>{{ item.description || 'Sin descripción registrada.' }}</p>
        <p>Precio de catálogo: {{ item.currency || 'PEN' }} {{ (item.price_in_cents / 100).toFixed(2) }}</p>
        <p>{{ item.provenance?.classification === 'explicit_demo' ? 'Registro de demostración en Supabase.' : 'Procedencia sin verificar.' }} La ficha no certifica disponibilidad para venta.</p>
      </section>
      <section class="card section-panel"><h2>Presentaciones</h2><ul>
        @for (presentation of item.presentations; track presentation.id) {
          <li>{{ presentation.sku }} · {{ presentation.factor_base_units }} unidades base · {{ presentation.price_cents }} céntimos</li>
        } @empty { <li>Sin presentaciones activas.</li> }
      </ul></section>
      <section class="card section-panel"><h2>Imágenes publicadas</h2><ul>
        @for (image of item.images; track image.id) {
          <li>{{ image.alt_text || image.storage_path }} · {{ image.mime_type }}</li>
        } @empty { <li>Sin metadatos de imágenes publicadas.</li> }
      </ul>@if (item.images.length) { <p>La vista previa requiere una URL de entrega autorizada por el backend.</p> }</section>
      @if (canEdit()) {
        <details class="card demo-editor" #editor (toggle)="prepare(editor.open)"><summary>Editar ficha</summary>
          @if (referencesLoading()) { <p role="status">Cargando categorías y marcas…</p> }
          @else if (referencesError()) { <p role="alert">{{ referencesError() }} <button type="button" (click)="prepare(true)">Reintentar</button></p> }
          @else if (referencesReady()) {
            <form #form (submit)="save($event, form, item)">
              <label>Nombre<input name="name" [value]="item.name" required maxlength="300"></label>
              <label>Descripción<textarea name="description" [value]="item.description ?? ''" maxlength="5000"></textarea></label>
              <label>Categoría<select name="category_id">
                <option [value]="item.category_id ?? ''" selected>{{ item.category || 'Sin categoría' }} (actual)</option>
                @for (category of catalog.categories(); track category.id) {
                  @if (category.id !== item.category_id) { <option [value]="category.id">{{ category.name }}</option> }
                }
              </select></label>
              <label>Marca<select name="brand_id">
                <option [value]="item.brand_id ?? ''" selected>{{ item.brand || 'Sin marca' }} (actual)</option>
                @if (item.brand_id) { <option value="">Sin marca</option> }
                @for (brand of catalog.brands(); track brand.id) {
                  @if (brand.id !== item.brand_id) { <option [value]="brand.id">{{ brand.name }}</option> }
                }
              </select></label>
              <label>Precio <input name="price" [value]="(item.price_in_cents / 100).toFixed(2)" required inputmode="decimal"></label>
              <label>Estado<select name="status">
                <option [value]="item.status" selected>Conservar estado actual</option>
                @if (item.status !== 'draft') { <option value="draft">Borrador</option> }
                @if (item.status !== 'archived') { <option value="archived">Archivado</option> }
              </select></label>
              <label><input type="checkbox" name="requires_prescription" [checked]="item.requires_prescription"> Requiere receta</label>
              <button type="submit" class="primary-button" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar cambios' }}</button>
            </form>
          }
        </details>
        <p role="status">{{ feedback() }}</p>
      }
    }
  `,
})
export class ProductDetailPage {
  private readonly api = inject(AdminApi);
  private readonly session = inject(AuthSession);
  protected readonly catalog = inject(CatalogStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly path = 'catalog/products/' + encodeURIComponent(this.id);
  protected readonly canEdit = computed(() => this.session.user()?.roles.includes('administrator') === true);
  protected readonly product = signal<ProductDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly feedback = signal('');
  protected readonly referencesLoading = signal(false);
  protected readonly referencesReady = signal(false);
  protected readonly referencesError = signal('');

  constructor() { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const { data } = await this.api.get<{data: ProductDetail}>(this.path);
      if (data?.id !== this.id || !Number.isInteger(data.version) || !Array.isArray(data.images) || !Array.isArray(data.presentations)) {
        throw new Error('La ficha no tiene el formato esperado.');
      }
      this.product.set(data);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async prepare(open: boolean): Promise<void> {
    if (!open || this.referencesReady() || this.referencesLoading()) return;
    this.referencesLoading.set(true);
    this.referencesError.set('');
    try {
      await this.catalog.editReferences();
      this.referencesReady.set(true);
    } catch (error) {
      this.referencesError.set((error as Error).message);
    } finally {
      this.referencesLoading.set(false);
    }
  }

  protected async save(event: Event, form: HTMLFormElement, current: ProductDetail): Promise<void> {
    event.preventDefault();
    if (!this.canEdit() || this.saving() || !form.reportValidity()) return;
    this.saving.set(true);
    this.feedback.set('');
    try {
      const values = new FormData(form);
      const get = (key: string) => String(values.get(key) ?? '').trim();
      const name = get('name');
      if (!name) throw new Error('Completa el nombre del producto.');
      const fields = {
        name, description: get('description'), category_id: get('category_id') || null,
        brand_id: get('brand_id') || null, price_in_cents: priceMinor(get('price')),
        status: get('status'), requires_prescription: values.has('requires_prescription'),
      };
      const changes = Object.fromEntries(Object.entries(fields).filter(([field, value]) => {
        const previous = current[field as keyof typeof fields];
        return field === 'description' ? value !== (previous ?? '') : value !== previous;
      }));
      if (!Object.keys(changes).length) { this.feedback.set('No hay cambios para guardar.'); return; }
      const { data } = await this.api.patch<{data: ProductDetail}>(this.path, { expected_version: current.version, ...changes });
      this.product.set(data);
      this.feedback.set('Ficha actualizada.');
    } catch (error) {
      this.feedback.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
