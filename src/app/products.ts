import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { CatalogStore, ProductDraft } from './catalog-store';
import { AuthSession } from './auth-session';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'botica-admin-products',
  imports: [RouterLink],
  template: `
    <section class="page-intro"><h1>Productos</h1><p>Consulta las referencias del catálogo.</p>
      <div class="demo-notice"><strong>Catálogo compartido.</strong> Las muestras se identifican según la procedencia devuelta por el backend. La publicación de una ficha no autoriza su venta.</div>
    </section>
    @if (inventory.error()) { <p class="form-error" role="alert">{{ inventory.error() }} <button type="button" (click)="reload()">Reintentar</button></p> }
    @if (canManage()) {
    <details class="card demo-editor"><summary>Categorías, marcas y unidades base</summary>
      <form #directoryForm (submit)="directory($event, directoryForm)">
        <label>Tipo<select #directoryKind name="resource" (change)="directoryType.set(directoryKind.value)"><option value="categories">Categoría</option><option value="brands">Marca</option><option value="base-units">Unidad base</option></select></label>
        <label>Nombre<input name="name" required maxlength="100"></label>
        @if (directoryType() === 'base-units') { <label>Código de unidad<input name="code" required maxlength="40" pattern="[a-z][a-z0-9_]*"></label> }
        <button type="submit" class="primary-button" [disabled]="saving()">Guardar referencia</button>
      </form>
    </details>
    <details class="card demo-editor" [open]="editorOpen()" (toggle)="editorOpen.set(productEditor.open); ifOpen(productEditor.open)" #productEditor>
      <summary>Nuevo producto</summary>
      <form #editor data-testid="product-form" (submit)="save($event, editor)">
        <label>Nombre<input #name name="name" required maxlength="100" [value]="draft().name" (input)="updateDraft('name', name.value)"></label>
        <label>SKU del producto y primera presentación<input #sku name="sku" required maxlength="100" [value]="draft().sku" (input)="updateDraft('sku', sku.value)"></label>
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
            @for (item of inventory.categories(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
          </select>
        </div>
        <label>Marca<select #brand name="brand" [value]="draft().brand" (change)="updateDraft('brand',brand.value)"><option value="">Sin marca seleccionada</option>@for(item of inventory.brands(); track item.id){<option [value]="item.id">{{item.name}}</option>}</select></label>
        <label>Unidad base<select #baseUnit name="baseUnit" required [value]="draft().baseUnit" (change)="updateDraft('baseUnit',baseUnit.value)"><option value="">Selecciona una unidad</option>@for(item of inventory.baseUnits(); track item.id){<option [value]="item.id">{{item.name}}</option>}</select></label>
        <label>Unidades base por presentación<input #factor name="factor" required inputmode="numeric" pattern="[1-9][0-9]*" maxlength="19" [value]="draft().factor" (input)="updateDraft('factor',factor.value)"></label>
        <label>Tipo<select #kind name="kind" [value]="draft().kind" (change)="updateDraft('kind',kind.value)"><option value="sealed">Envase intacto</option><option value="loose">Unidad suelta autorizada</option></select></label>
        <label>¿Permite fraccionamiento?<select #fractionable name="fractionable" required [value]="draft().fractionable" (change)="updateDraft('fractionable',fractionable.value)"><option value="">Selecciona</option><option value="true">Sí, autorizado</option><option value="false">No</option></select></label>
        <label>¿Requiere vencimiento?<select #expiryRequired name="expiryRequired" required [value]="draft().expiryRequired" (change)="updateDraft('expiryRequired',expiryRequired.value)"><option value="">Selecciona</option><option value="true">Sí</option><option value="false">No</option></select></label>
        <label>¿Requiere receta?<select #prescription name="requiresPrescription" required [value]="draft().requiresPrescription" (change)="updateDraft('requiresPrescription',prescription.value)"><option value="">Selecciona</option><option value="true">Sí</option><option value="false">No</option></select></label>
        <p>Las fichas nuevas se registran como borrador.</p>
        <label>Precio de la primera presentación (S/)<input #price name="price" type="number" min="0" step="0.01" placeholder="0,00"
          required [value]="draft().price" (input)="updateDraft('price', price.value)"></label>
        <button type="submit" class="primary-button" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Crear producto' }}</button>
      </form>
    </details>
    <details class="card demo-editor"><summary>Añadir otra presentación</summary><form #presentationForm (submit)="addPresentation($event,presentationForm)">
      <label>Producto<select name="product" required><option value="">Selecciona</option>@for(item of inventory.products();track item.id){<option [value]="item.id">{{item.name}} · {{item.sku}}</option>}</select></label>
      <label>Presentación<input name="presentation" required maxlength="80"></label><label>SKU propio<input name="sku" required maxlength="100"></label>
      <label>Unidades base<input name="factor" required inputmode="numeric" pattern="[1-9][0-9]*" maxlength="19"></label>
      <label>Tipo<select name="kind"><option value="sealed">Envase intacto</option><option value="loose">Unidad suelta autorizada</option></select></label>
      <label>Precio (S/)<input name="price" type="number" required min="0" step="0.01"></label><button type="submit" class="primary-button" [disabled]="saving()">Añadir presentación</button>
    </form></details>
    <details class="card demo-editor" #ruleDetails (toggle)="ifOpen(ruleDetails.open)"><summary>Autorizar una apertura</summary><form #ruleForm (submit)="rule($event,ruleForm)">
      <label>Presentación de origen<select name="source" required><option value="">Selecciona</option>@for(item of inventory.presentations();track item.id){<option [value]="item.id">{{item.sku}} · {{item.presentation_code}} · {{item.factor_base_units}} unidades</option>}</select></label>
      <label>Presentación resultante<select name="target" required><option value="">Selecciona</option>@for(item of inventory.presentations();track item.id){<option [value]="item.id">{{item.sku}} · {{item.presentation_code}} · {{item.factor_base_units}} unidades</option>}</select></label>
      <label>Cantidad de presentaciones resultantes<input name="count" required inputmode="numeric" pattern="[1-9][0-9]*" maxlength="19"></label>
      <label>Referencia de autorización<input name="reference" required maxlength="500"></label><button type="submit" class="primary-button" [disabled]="saving()">Guardar autorización</button>
    </form></details>
    }
    <p class="demo-feedback" role="status">{{ feedback() }}</p>
    <section class="card" aria-label="Catálogo" [attr.aria-busy]="inventory.loading()">
      <div class="module-filters"><label>Nombre o SKU
        <input #search type="search" maxlength="200" (input)="searchProducts(search.value)">
      </label>
      <label>Estado en esta página<select #statusFilter (change)="status.set(statusFilter.value)"><option value="">Todos</option><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label></div>
      @if (inventory.loading()) { <div class="skeleton" role="status" aria-label="Cargando catálogo"></div> }
      @else if (!inventory.error()) {
      <div class="table-scroll"><table><thead><tr><th scope="col">Producto</th><th scope="col">SKU</th><th scope="col">Estado</th></tr></thead>
        <tbody>
          @for (product of visibleProducts(); track product.id) {
            <tr><th scope="row">{{ product.name }}
              @if (product.presentation) { <small>{{ product.presentation }} · {{ product.category }} @if (product.brand) { · {{ product.brand }} } · S/ {{ (product.price_in_cents / 100).toFixed(2) }}</small> }
            </th><td>{{ product.sku }}<small>{{ product.provenance?.classification === 'explicit_demo' ? 'Demostración · Supabase' : 'Procedencia sin verificar' }}</small></td><td><span class="pill">{{ statusLabel(product.status) }}</span>
              <small><a [routerLink]="['/productos', product.id]">Ver ficha</a></small>
              <small><a routerLink="/presentaciones" [queryParams]="{ product_id: product.id }">Ver presentaciones</a></small>
            </td></tr>
          } @empty { <tr><td colspan="3">{{ status() ? 'No hay coincidencias en esta página.' : 'No hay productos que coincidan.' }}</td></tr> }
        </tbody>
      </table></div>
      <div class="pagination">
        <button type="button" [disabled]="page() === 1" (click)="reload()">Primera página</button>
        <span>Página {{ page() }}</span>
        <button type="button" [disabled]="!inventory.next()" (click)="nextPage()">Siguiente</button>
      </div>
      }
    </section>
  `,
})
export class ProductsPage implements OnInit {
  protected statusLabel(status:string):string {
    return ({draft:'Borrador',published:'Publicado',archived:'Archivado'} as Record<string,string>)[status] ?? status;
  }
  protected readonly inventory = inject(CatalogStore);
  private readonly session = inject(AuthSession);
  protected readonly canManage = computed(()=>this.session.user()?.roles.includes('administrator')===true);
  protected readonly saving = signal(false);
  protected readonly directoryType = signal('categories');
  protected readonly page = signal(1);
  protected readonly status = signal('');
  protected readonly visibleProducts = computed(() => this.inventory.products().filter(product => !this.status() || product.status === this.status()));
  private readonly search = new Subject<string>();
  private referencesRequested = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.inventory.cancelProducts());
    this.search.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
  }
  ngOnInit():void {this.reload(); if (this.editorOpen()) this.ifOpen(true);}
  protected reload():void {this.page.set(1); void this.inventory.loadProducts(this.query());}
  protected searchProducts(value: string): void {
    const query = value.trim();
    if (query === this.query()) return;
    this.query.set(query);
    this.inventory.cancelProducts();
    this.search.next(query);
  }
  protected async nextPage(): Promise<void> {
    if (!this.inventory.next() || this.inventory.loading()) return;
    await this.inventory.loadProducts(this.query(), true);
    if (!this.inventory.error()) this.page.update(page => page + 1);
  }
  protected ifOpen(open: boolean): void {
    if (!open || this.referencesRequested) return;
    this.referencesRequested = true;
    void this.inventory.references().then(() => { if (this.inventory.error()) this.referencesRequested = false; });
  }
  protected readonly draft = this.inventory.productDraft;
  protected readonly editorOpen = signal(Object.entries(this.draft()).some(([key,value])=>!['kind','status'].includes(key)&&Boolean(value)));
  protected readonly activeHelp = signal<'presentation' | 'category' | null>(null);

  protected closeHelp(field: 'presentation' | 'category'): void {
    if (this.activeHelp() === field) this.activeHelp.set(null);
  }
  protected readonly feedback = signal('');
  protected readonly query = signal('');

  protected async save(event: Event, form: HTMLFormElement): Promise<void> {
    await this.command(event,form,()=>this.inventory.createProduct(new FormData(form)),'Producto guardado. Puedes registrar su recepción en Inventario.');
  }
  protected async directory(event:Event,form:HTMLFormElement):Promise<void> {
    const fields=new FormData(form);const code=String(fields.get('code')??'');
    await this.command(event,form,async()=>{await this.inventory.createDirectory(String(fields.get('resource')),{name:String(fields.get('name')).trim(),...(code?{code}:{})});this.directoryType.set('categories');},'Referencia guardada.');
  }
  protected async addPresentation(event:Event,form:HTMLFormElement):Promise<void> {await this.command(event,form,()=>this.inventory.createPresentation(new FormData(form)),'Presentación guardada sin modificar factores anteriores.');}
  protected async rule(event:Event,form:HTMLFormElement):Promise<void> {await this.command(event,form,()=>this.inventory.createRule(new FormData(form)),'Autorización de apertura guardada.');}
  private async command(event:Event,form:HTMLFormElement,action:()=>Promise<void>,message:string):Promise<void> {
    event.preventDefault();if(this.saving()||!form.reportValidity())return;this.saving.set(true);this.feedback.set('');
    try{await action();form.reset();this.feedback.set(message);}catch(error){this.feedback.set((error as Error).message);}finally{this.saving.set(false);}
  }
  protected updateDraft(field: keyof ProductDraft, value: string): void {
    this.draft.update(current => ({ ...current, [field]: value }));
  }
}
