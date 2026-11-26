import { Injectable, inject, signal } from '@angular/core';
import { ADMIN_PAGE_SIZE, AdminApi } from './admin-api';
import { CatalogStore, CatalogProduct } from './catalog-store';

export interface Warehouse {id:string;code:string;name:string;active:boolean}
export interface Supplier {id:string;name:string;document_number:string|null;active?:boolean}
export interface Stock {id:string;product_id:string;lot_id:string;warehouse_id:string;condition:string;on_hand_base:string;reserved_base:string;unreserved_base:string;saleable_base:string}
export interface Lot {id:string;product_id:string;lot_number:string;expiry_precision:string;expiry_year:number|null;expiry_month:number|null;expiry_day:number|null;quality_status:string}
export interface PhysicalPackage {id:string;product_id:string;presentation_id:string;lot_id:string;warehouse_id:string;state:string;contents_base:string;reserved_base:string}
export interface Movement {id:string;product_id:string;lot_id:string;warehouse_id:string;physical_delta:string;reserved_delta:string;actor_id:string;created_at:string;kind:string}
export interface Operation {id:string;kind:string;actor_id:string;created_at:string;details:Record<string,unknown>}
export interface Receipt {id:string;supplier_id:string;warehouse_id:string;document_reference:string;actor_id:string;created_at:string;items:{id:string;product_id:string;lot_id:string;presentation_id:string;quantity_base:string;presentation_quantity:number}[]}
export interface InventoryPolicy {commercial_enabled:boolean;sanitary_release_enabled:boolean}
interface ReportedStock extends Omit<Stock,'on_hand_base'|'saleable_base'> {physical_base:string;authorized_for_sale_base:string}
interface Page<T>{data:T[];next_cursor:string|null}

export function printedExpiry(lot:Pick<Lot,'expiry_precision'|'expiry_year'|'expiry_month'|'expiry_day'>):string {
  if(lot.expiry_precision==='not_applicable')return 'No corresponde';
  const month=String(lot.expiry_month).padStart(2,'0');
  return lot.expiry_precision==='month'?`${month}/${lot.expiry_year} (mes y año)`:`${String(lot.expiry_day).padStart(2,'0')}/${month}/${lot.expiry_year}`;
}

export function receiptPayload(fields:FormData):Record<string,unknown> {
  const text=(key:string)=>String(fields.get(key)??'').trim();const quantity=Number(text('quantity'));
  if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw new Error('La cantidad debe ser un entero entre 1 y 1000.');
  const precision=text('expiry_precision');
  const result:Record<string,unknown>={warehouse_id:text('warehouse_id'),supplier_id:text('supplier_id'),presentation_id:text('presentation_id'),document_reference:text('document_reference'),lot_number:text('lot_number'),quantity,expiry_precision:precision};
  if(!['day','month','not_applicable'].includes(precision))throw new Error('Selecciona la precisión original del vencimiento.');
  if(precision!=='not_applicable') {
    const date=text(precision==='month'?'expiry_month':'expiry_day');
    if(!(precision==='month'?/^\d{4}-\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(date))throw new Error('Completa el vencimiento impreso en el envase.');
    const [year,month,day]=date.split('-').map(Number);
    if(year<1900||year>9998||month<1||month>12)throw new Error('El vencimiento no es válido.');
    if(precision==='day') {
      const actual=new Date(Date.UTC(year,month-1,day));
      if(actual.getUTCFullYear()!==year||actual.getUTCMonth()!==month-1||actual.getUTCDate()!==day)throw new Error('El vencimiento no es válido.');
      result['expiry_day']=day;
    }
    result['expiry_year']=year;result['expiry_month']=month;
  }
  return result;
}

@Injectable({providedIn:'root'})
export class InventoryStore {
  private readonly api=inject(AdminApi);readonly catalog=inject(CatalogStore);
  readonly products=signal<CatalogProduct[]>([]);readonly warehouses=signal<Warehouse[]>([]);readonly suppliers=signal<Supplier[]>([]);
  readonly stock=signal<Stock[]>([]);readonly lots=signal<Lot[]>([]);readonly packages=signal<PhysicalPackage[]>([]);
  readonly movements=signal<Movement[]>([]);readonly operations=signal<Operation[]>([]);
  readonly receipts=signal<Receipt[]>([]);readonly policy=signal<InventoryPolicy|null>(null);
  readonly policyUnavailable = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly next = signal<string | null>(null);
  readonly formsLoading = signal(false);
  readonly formsError = signal('');
  private currentView: 'stock' | 'receipts' | 'lots' | 'movements' = 'stock';
  private cursor: string | null = null;
  private warehouse = '';
  private product = '';
  private generation = 0;

  private async page<T>(resource: string, cursor = this.cursor): Promise<Page<T>> {
    const params = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE) });
    if (cursor) params.set('after', cursor);
    if (this.currentView === 'stock' && this.warehouse && resource === 'reports/stock') params.set('warehouse_id', this.warehouse);
    if (this.currentView === 'stock' && this.product && resource === 'reports/stock') params.set('product_id', this.product);
    const page = await this.api.get<Page<T>>('inventory/' + resource + '?' + params);
    if (!Array.isArray(page.data) || (page.next_cursor !== null && typeof page.next_cursor !== 'string')) {
      throw new Error('La respuesta de inventario no tiene el formato esperado.');
    }
    return page;
  }

  async load(view = this.currentView, cursor = this.cursor, warehouse = this.warehouse, product = this.product): Promise<void> {
    this.currentView = view;
    this.cursor = cursor;
    this.warehouse = warehouse;
    this.product = product;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.policy.set(null);
    this.policyUnavailable.set(false);
    const isCurrent = () => generation === this.generation;
    const background = async <T>(request: Promise<T>, assign: (result: T) => void) => {
      try { const result = await request; if (isCurrent()) assign(result); }
      catch { }
    };
    void this.api.get<{data:InventoryPolicy}>('inventory/management/policy').then(result => {
      if (!isCurrent()) return;
      if (typeof result.data?.commercial_enabled === 'boolean' && typeof result.data.sanitary_release_enabled === 'boolean') this.policy.set(result.data);
      else this.policyUnavailable.set(true);
    }).catch(() => {
      if (isCurrent()) this.policyUnavailable.set(true);
    });
    if (view === 'stock') void background(this.allOptions<Warehouse>('warehouses'), result => this.warehouses.set(result));
    try {
      if (view === 'stock') {
        const page = await this.page<ReportedStock>('reports/stock');
        const rows = page.data.map(row => {
          if (![row.physical_base, row.reserved_base, row.authorized_for_sale_base].every(value => typeof value === 'string' && /^\d+$/.test(value))) {
            throw new Error('La respuesta de existencias no es válida.');
          }
          return { ...row, on_hand_base: row.physical_base, saleable_base: row.authorized_for_sale_base };
        });
        if (isCurrent()) { this.stock.set(rows); this.next.set(page.next_cursor); }
      } else if (view === 'receipts') {
        const page = await this.page<Receipt>('paged-receipts');
        if (isCurrent()) { this.receipts.set(page.data); this.next.set(page.next_cursor); }
      } else if (view === 'lots') {
        const page = await this.page<Lot>('paged-lots');
        if (isCurrent()) { this.lots.set(page.data); this.next.set(page.next_cursor); }
      } else {
        const page = await this.page<Movement>('paged-movements');
        if (isCurrent()) {
          this.movements.set(page.data); this.next.set(page.next_cursor);
          void background(this.page<Operation>('paged-operations', null), result => this.operations.set(result.data));
        }
      }
    } catch (error) {
      if (isCurrent()) { this.error.set((error as Error).message); this.next.set(null); }
    } finally {
      if (isCurrent()) this.loading.set(false);
    }
  }

  async loadFormOptions(mode: 'receipts' | 'packages'): Promise<void> {
    if (this.formsLoading()) return;
    this.formsLoading.set(true);
    this.formsError.set('');
    try {
      if (mode === 'receipts') {
        const [warehouses, suppliers] = await Promise.all([
          this.allOptions<Warehouse>('warehouses'), this.allOptions<Supplier>('suppliers'),
          this.catalog.references(),
        ]);
        this.warehouses.set(warehouses); this.suppliers.set(suppliers.filter(supplier=>supplier.active!==false));
      } else {
        const [packages, lots, warehouses] = await Promise.all([
          this.allOptions<PhysicalPackage>('packages'), this.allOptions<Lot>('lots'),
          this.allOptions<Warehouse>('warehouses'), this.catalog.references(),
        ]);
        this.packages.set(packages); this.lots.set(lots); this.warehouses.set(warehouses);
      }
      if (this.catalog.error()) this.formsError.set(this.catalog.error());
    } catch (error) {
      this.formsError.set((error as Error).message);
    } finally {
      this.formsLoading.set(false);
    }
  }

  private async allOptions<T>(resource: string): Promise<T[]> {
    const rows: T[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const result: Page<T> = await this.api.get<Page<T>>('inventory/paged-' + resource + '?limit=200' + (cursor ? '&after=' + encodeURIComponent(cursor) : ''));
      if (!Array.isArray(result.data)) throw new Error('No se pudieron leer las opciones.');
      rows.push(...result.data);
      cursor = result.next_cursor;
      if (cursor && seen.has(cursor)) throw new Error('No se pudieron leer todas las opciones.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    return rows;
  }
  async configure(resource:'warehouses'|'suppliers',fields:FormData):Promise<void> {
    const name=String(fields.get('name')??'').trim();
    const body=resource==='warehouses'?{name,code:String(fields.get('code')??'').trim()}:{name,...(fields.get('document_number')?{document_number:String(fields.get('document_number')).trim()}:{})};
    await this.api.post('inventory/'+resource,body);await this.load();
  }
  async receive(fields:FormData):Promise<void> {await this.api.post('inventory/receipts',receiptPayload(fields));await this.load();}
  async adjust(fields:FormData):Promise<void> {
    const value=(key:string)=>String(fields.get(key)??'').trim();
    if(!/^[1-9][0-9]{0,18}$/.test(value('quantity_base'))||BigInt(value('quantity_base'))>9223372036854775807n)throw new Error('Escribe una cantidad positiva de unidades base.');
    await this.api.post('inventory/adjustments',{package_id:value('package_id'),kind:value('kind'),direction:value('direction'),quantity_base:value('quantity_base'),reason:value('reason'),reference:value('reference')});await this.load();
  }
  async open(packageId:string,ruleId:string):Promise<void> {
    const physical=this.packages().find(value=>value.id===packageId);const rule=this.catalog.rules().find(value=>value.id===ruleId&&value.active);
    if(!physical||physical.state!=='sealed'||physical.reserved_base!=='0'||!rule||rule.source_presentation_id!==physical.presentation_id)throw new Error('Selecciona un envase intacto sin reserva y una regla vigente compatible.');
    await this.api.post('inventory/openings',{package_id:packageId,rule_id:ruleId});await this.load();
  }
}
