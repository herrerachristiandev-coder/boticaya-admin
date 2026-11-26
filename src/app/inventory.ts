import { Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from './auth-session';
import { InventoryStore, printedExpiry } from './inventory-store';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ADMIN_PAGE_SIZE, AdminApi, CursorPage } from './admin-api';
import { CatalogProduct } from './catalog-store';
import { catchError, distinctUntilChanged, map, of, switchMap, timer } from 'rxjs';

@Component({
  selector:'botica-admin-inventory',
  imports:[RouterLink],
  template:`
    <section class="page-intro"><h1>Inventario</h1><p>Existencias reales por producto, lote y almacén.</p>
      <div class="demo-notice">Las entradas se reciben en cuarentena. La habilitación sanitaria para venta está pendiente; stock sin reserva no significa stock apto para vender.</div>
    </section>
    <nav class="module-filters" aria-label="Vistas de inventario"><a routerLink="/inventario/stock">Stock</a><a routerLink="/inventario/recepciones">Recepciones</a><a routerLink="/inventario/lotes">Lotes</a><a routerLink="/inventario/movimientos">Movimientos</a></nav>
    @if(store.policy();as policy){<p class="notice">Ventas: {{policy.commercial_enabled?'habilitadas por política':'desactivadas'}} · Liberación sanitaria: {{policy.sanitary_release_enabled?'habilitada por procedimiento':'desactivada'}}</p>}
    @if(store.policyUnavailable()){<p class="notice" role="status">No se pudo verificar la política de venta y liberación sanitaria. <button type="button" (click)="store.load()">Reintentar</button></p>}
    @if(store.loading()){<div class="skeleton" role="status" aria-label="Cargando inventario"></div>}
    @if(store.error()){<p class="notice" role="alert">{{store.error()}} <button (click)="store.load()">Reintentar</button></p>}
    @if(store.formsLoading()){<p role="status">Cargando opciones del formulario…</p>}
    @if(store.formsError()){<p class="notice" role="alert">{{store.formsError()}} <button (click)="store.loadFormOptions(view()==='receipts'?'receipts':'packages')">Reintentar opciones</button></p>}
    @if(administrator() && view()==='stock') {
      <details class="card demo-editor"><summary>Configurar almacén o proveedor</summary>
        <form #directory (submit)="configure($event,directory)">
          <label>Tipo<select name="resource"><option value="warehouses">Almacén</option><option value="suppliers">Proveedor</option></select></label>
          <label>Nombre<input name="name" required maxlength="200"></label>
          <label>Código de almacén<input name="code" maxlength="60"></label>
          <label>Documento de proveedor<input name="document_number" maxlength="40"></label>
          <button class="primary-button" [disabled]="busy()">Guardar configuración</button>
        </form>
      </details>
    }
    @if(view()==='receipts'){
    <details class="card demo-editor" #intake (toggle)="loadOptions(intake.open,'receipts')"><summary>Registrar recepción</summary>
      <p>Una presentación por recepción en esta etapa. Registra el documento real, sin crear referencias ficticias.</p>
      <form #receipt data-testid="receipt-form" (submit)="receive($event,receipt)">
        <label>Almacén<select name="warehouse_id" required><option value="">Selecciona</option>@for(w of store.warehouses();track w.id){@if(w.active){<option [value]="w.id">{{w.name}}</option>}}</select></label>
        <label>Proveedor<select name="supplier_id" required><option value="">Selecciona</option>@for(s of store.suppliers();track s.id){<option [value]="s.id">{{s.name}}</option>}</select></label>
        <label>Presentación recibida<select name="presentation_id" required><option value="">Selecciona</option>@for(p of store.catalog.presentations();track p.id){@if(p.active&&p.authorized_for_receipt){<option [value]="p.id">{{p.presentation_code}} · {{p.sku}} · {{p.factor_base_units}} unidades base</option>}}</select></label>
        <label>Documento de recepción<input name="document_reference" required maxlength="100"></label>
        <label>Lote impreso<input name="lot_number" required maxlength="100"></label>
        <label>Cantidad de presentaciones<input name="quantity" type="number" min="1" max="1000" step="1" required></label>
        <label>Precisión del vencimiento<select name="expiry_precision" #precision (change)="expiryPrecision.set(precision.value)" required><option value="">Selecciona</option><option value="day">Día, mes y año</option><option value="month">Solo mes y año</option><option value="not_applicable">No corresponde según producto</option></select></label>
        @if(expiryPrecision()==='day'){<label>Fecha impresa<input name="expiry_day" type="date" required></label>}
        @if(expiryPrecision()==='month'){<label>Mes y año impresos<input name="expiry_month" type="month" required></label>}
        <button class="primary-button" [disabled]="busy()||store.formsLoading()||!!store.formsError()">Registrar recepción</button>
      </form>
    </details>
    @if(!store.loading()&&!store.error()){<section class="card section-panel"><h2>Recepciones registradas</h2><div class="record-list">@for(receipt of store.receipts();track receipt.id){<details><summary>{{receipt.document_reference}} · {{warehouseName(receipt.warehouse_id)}} · {{receipt.created_at}}</summary><div class="record-detail"><p>Proveedor: {{supplierName(receipt.supplier_id)}} · Responsable: {{actor(receipt.actor_id)}}</p>@for(item of receipt.items;track item.id){<p>{{productName(item.product_id)}} · {{presentationName(item.presentation_id)}} · Lote {{lotName(item.lot_id)}} · {{item.quantity_base}} unidades base</p>}</div></details>}@empty{<p class="record-detail">Todavía no hay recepciones registradas.</p>}</div></section>}
    }
    @if(view()==='stock'){
    <details class="card demo-editor" #openingOptions (toggle)="loadOptions(openingOptions.open,'packages')"><summary>Abrir una presentación manualmente</summary>
      <p>Confirma la apertura física. Esta operación conserva el total de unidades base y no admite envases reservados.</p>
      <form #opening data-testid="opening-form" (submit)="open($event,opening)">
        <label>Envase intacto<select name="package_id" required #physical (change)="selectedPackage.set(physical.value)"><option value="">Selecciona</option>@for(p of intactPackages();track p.id){<option [value]="p.id">{{presentationName(p.presentation_id)}} · lote {{lotName(p.lot_id)}} · {{warehouseName(p.warehouse_id)}} · {{p.id}}</option>}</select></label>
        <label>Regla autorizada<select name="rule_id" required><option value="">Selecciona</option>@for(r of compatibleRules();track r.id){<option [value]="r.id">{{r.child_count}} × {{presentationName(r.target_presentation_id)}} · {{r.authorization_reference}}</option>}</select></label>
        <label><input name="confirmed" type="checkbox" required> Confirmo que realizaré esta apertura física.</label>
        <button class="primary-button" [disabled]="busy()||store.formsLoading()||!!store.formsError()">Confirmar apertura</button>
      </form>
    </details>
    @if(administrator()) {
      <details class="card demo-editor" #adjustmentOptions (toggle)="loadOptions(adjustmentOptions.open,'packages')"><summary>Registrar pérdida o ajuste autorizado</summary>
        <p>El administrador autoriza su operación con motivo y referencia. Los incrementos ingresan en cuarentena; un envase intacto solo puede retirarse completo.</p>
        <form #adjustment data-testid="adjustment-form" (submit)="adjust($event,adjustment)">
          <label>Operación<select name="kind"><option value="loss">Pérdida</option><option value="adjustment">Ajuste</option></select></label>
          <label>Sentido<select name="direction"><option value="decrease">Disminución</option><option value="increase">Incremento (solo ajuste)</option></select></label>
          <label>Envase de referencia<select name="package_id" required><option value="">Selecciona</option>@for(p of store.packages();track p.id){<option [value]="p.id">{{presentationName(p.presentation_id)}} · {{lotName(p.lot_id)}} · {{warehouseName(p.warehouse_id)}} · {{p.id}}</option>}</select></label>
          <label>Cantidad en unidades base<input name="quantity_base" inputmode="numeric" pattern="[1-9][0-9]*" required maxlength="19"></label>
          <label>Motivo<textarea name="reason" required maxlength="1000"></textarea></label>
          <label>Referencia documental<input name="reference" required maxlength="200"></label>
          <label><input name="confirmed" type="checkbox" required> Autorizo esta operación y su registro de auditoría.</label>
          <button class="primary-button" [disabled]="busy()||store.formsLoading()||!!store.formsError()">Confirmar operación</button>
        </form>
      </details>
    }
    }
    <p class="demo-feedback" role="status">{{feedback()}}</p>
    @if(!store.loading()&&!store.error()){
    @if(view()==='stock'){
    <section class="card module-card" aria-label="Existencias por lote">
      <div class="module-filters">
        <label>Buscar producto o SKU<input type="search" #search maxlength="200" [value]="query()" (input)="query.set(search.value)"></label>
        <label>Producto<select #product (change)="productFilter.set(product.value); firstPage()" [value]="productFilter()"><option value="">Todos</option>
          @for(item of productMatches().data;track item.id){<option [value]="item.id">{{item.name}} · {{item.sku}}</option>}
        </select></label>
        @if(productMatches().error){<span role="status">{{productMatches().error}}</span>}
        <label>Almacén<select #warehouse (change)="warehouseFilter.set(warehouse.value); firstPage()" [value]="warehouseFilter()"><option value="">Todos</option>@for(w of store.warehouses();track w.id){<option [value]="w.id">{{w.name}}</option>}</select></label>
        <button (click)="store.load()" [disabled]="store.loading()">Actualizar</button></div>
      <div class="record-list">@for(b of store.stock();track b.id){<details><summary><span><strong>{{productName(b.product_id)}}</strong><small>Lote {{lotName(b.lot_id)}} · {{warehouseName(b.warehouse_id)}}</small></span><span>{{b.on_hand_base}} unidades base</span></summary>
        <div class="record-detail"><p>Condición: {{conditionName(b.condition)}} · Reservadas: {{b.reserved_base}} · Sin reserva: {{b.unreserved_base}} · Aptas para venta: {{b.saleable_base}}</p>
          @for(lot of store.lots();track lot.id){@if(lot.id===b.lot_id){<p>Vencimiento impreso: {{expiry(lot)}} · Estado de calidad: {{conditionName(lot.quality_status)}}</p>}}
          <h2>Presentaciones físicas</h2>@for(p of store.packages();track p.id){@if(p.lot_id===b.lot_id&&p.warehouse_id===b.warehouse_id){<p>{{presentationName(p.presentation_id)}} · {{packageState(p.state)}} · Contenido {{p.contents_base}} · Reservado {{p.reserved_base}} · {{p.id}}</p>}}
        </div></details>}@empty{<p class="record-detail" role="status">No hay existencias con estos filtros.</p>}</div>
    </section>
    }
    @if(view()==='lots'){
    <section class="card module-card"><h2>Lotes y vencimientos</h2><div class="table-scroll"><table><thead><tr><th>Producto</th><th>Lote</th><th>Vencimiento impreso</th><th>Calidad</th></tr></thead><tbody>@for(lot of store.lots();track lot.id){<tr><td>{{productName(lot.product_id)}}</td><td>{{lot.lot_number}}</td><td>{{expiry(lot)}}</td><td>{{conditionName(lot.quality_status)}}</td></tr>}@empty{<tr><td colspan="4">Todavía no hay lotes registrados.</td></tr>}</tbody></table></div></section>
    }
    @if(view()==='movements'){
    <section class="card module-card"><h2>Movimientos de stock físico</h2><div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Producto y lote</th><th>Almacén</th><th>Unidades base</th><th>Responsable</th></tr></thead><tbody>
      @for(m of store.movements();track m.id){<tr><td>{{m.created_at}}</td><td>{{productName(m.product_id)}} · {{lotName(m.lot_id)}}</td><td>{{warehouseName(m.warehouse_id)}}</td><td>{{m.physical_delta}}</td><td>{{actor(m.actor_id)}}</td></tr>}@empty{<tr><td colspan="5">Todavía no hay movimientos.</td></tr>}
    </tbody></table></div><h2>Registro de operaciones</h2><div class="record-list">@for(o of store.operations();track o.id){<article><p>{{operationName(o.kind)}} · {{o.created_at}} · {{actor(o.actor_id)}}</p>@if(o.details['reason']){<p>Motivo: {{o.details['reason']}} · Referencia: {{o.details['reference']}}</p>}<small>{{o.id}}</small></article>}@empty{<p>No hay operaciones registradas.</p>}</div></section>
    }
    <div class="pagination">
      <button type="button" [disabled]="!history().length" (click)="previous()">Anterior</button>
      <span>Página {{history().length + 1}}</span>
      <button type="button" [disabled]="!store.next()" (click)="advance()">Siguiente</button>
    </div>
    }
  `,
})
export class InventoryPage {
  private readonly routeData=toSignal(inject(ActivatedRoute).data);
  protected readonly view=computed<'stock'|'receipts'|'lots'|'movements'>(()=> {
    const view=this.routeData()?.['inventoryView'];
    return view==='receipts'||view==='lots'||view==='movements'?view:'stock';
  });
  protected readonly history=signal<(string|null)[]>([]);
  private cursor:string|null=null;
  protected readonly store=inject(InventoryStore);private readonly session=inject(AuthSession);
  protected readonly administrator=computed(()=>this.session.user()?.roles.includes('administrator')??false);
  protected readonly busy=signal(false);protected readonly feedback=signal('');protected readonly query=signal('');protected readonly warehouseFilter=signal('');
  protected readonly productFilter=signal('');
  private readonly api=inject(AdminApi);
  protected readonly productMatches=toSignal(toObservable(this.query).pipe(
    map(query=>query.trim()), distinctUntilChanged(),
    switchMap(query=>query ? timer(300).pipe(switchMap(()=>this.api.read<CursorPage<CatalogProduct>>('catalog/products?limit='+ADMIN_PAGE_SIZE+'&q='+encodeURIComponent(query))),map(page=>({data:page.data,error:''})),catchError((error:Error)=>of({data:[],error:error.message}))) : of({data:[],error:''})),
  ),{initialValue:{data:[] as CatalogProduct[],error:''}});
  protected readonly selectedPackage=signal('');protected readonly expiryPrecision=signal('');protected readonly expiry=printedExpiry;
  protected readonly intactPackages=computed(()=>this.store.packages().filter(p=>p.state==='sealed'&&p.reserved_base==='0'));
  protected readonly compatibleRules=computed(()=>{const p=this.store.packages().find(p=>p.id===this.selectedPackage());return this.store.catalog.rules().filter(r=>r.active&&r.source_presentation_id===p?.presentation_id);});
  constructor(){this.firstPage();}
  protected firstPage():void {this.history.set([]);this.readPage(null);}
  protected advance():void {const next=this.store.next();if(!next)return;this.history.update(values=>[...values,this.cursor]);this.readPage(next);}
  protected previous():void {const values=this.history();if(!values.length)return;this.history.set(values.slice(0,-1));this.readPage(values.at(-1)??null);}
  private readPage(cursor:string|null):void {this.cursor=cursor;void this.store.load(this.view(),cursor,this.warehouseFilter(),this.productFilter());}
  protected loadOptions(open:boolean,mode:'receipts'|'packages'):void {if(open)void this.store.loadFormOptions(mode);}
  protected productName(id:string):string{return this.store.products().find(p=>p.id===id)?.name??this.productMatches().data.find(p=>p.id===id)?.name??id;}
  protected presentationName(id:string):string{return this.store.catalog.presentations().find(p=>p.id===id)?.sku??id;}
  protected lotName(id:string):string{return this.store.lots().find(p=>p.id===id)?.lot_number??id;}
  protected warehouseName(id:string):string{return this.store.warehouses().find(p=>p.id===id)?.name??id;}
  protected supplierName(id:string):string{return this.store.suppliers().find(p=>p.id===id)?.name??id;}
  protected actor(id:string):string{return id===this.session.user()?.id?this.session.user()!.fullName:id;}
  protected conditionName(value:string):string{return ({quarantine:'Cuarentena',saleable:'Apto',released:'Liberado',blocked:'Bloqueado',recalled:'Retirado',rejected:'Rechazado'} as Record<string,string>)[value]??value;}
  protected packageState(value:string):string{return ({sealed:'Intacto',opened:'Abierto',loose:'Fraccionado',unverified:'Pendiente de inspección',depleted:'Agotado',dispatched:'Entregado'} as Record<string,string>)[value]??value;}
  protected operationName(value:string):string{return ({receipt:'Recepción',opening:'Apertura manual',loss:'Pérdida',adjustment:'Ajuste'} as Record<string,string>)[value]??value;}
  private async submit(event:Event,form:HTMLFormElement,operation:()=>Promise<void>,message:string):Promise<void>{
    event.preventDefault();if(this.busy())return;this.busy.set(true);this.feedback.set('');
    try{await operation();form.reset();this.selectedPackage.set('');this.expiryPrecision.set('');this.feedback.set(message+(this.store.error()?' La operación se guardó, pero debes actualizar la consulta.':''));}
    catch(error){this.feedback.set((error as Error).message);}finally{this.busy.set(false);}
  }
  protected configure(event:Event,form:HTMLFormElement):Promise<void>{return this.submit(event,form,async()=>{const f=new FormData(form);const resource=f.get('resource')==='suppliers'?'suppliers':'warehouses';if(resource==='warehouses'&&!String(f.get('code')??'').trim())throw new Error('Completa el código del almacén.');await this.store.configure(resource,f);},'Configuración guardada.');}
  protected receive(event:Event,form:HTMLFormElement):Promise<void>{return this.submit(event,form,()=>this.store.receive(new FormData(form)),'Recepción registrada en cuarentena.');}
  protected adjust(event:Event,form:HTMLFormElement):Promise<void>{return this.submit(event,form,async()=>{const f=new FormData(form);if(f.get('confirmed')!=='on')throw new Error('Confirma la autorización del ajuste.');await this.store.adjust(f);},'Operación autorizada y registrada con auditoría.');}
  protected open(event:Event,form:HTMLFormElement):Promise<void>{return this.submit(event,form,async()=>{const f=new FormData(form);if(f.get('confirmed')!=='on')throw new Error('Confirma la apertura física.');await this.store.open(String(f.get('package_id')),String(f.get('rule_id')));},'Apertura registrada. El stock físico total se conserva.');}
}
