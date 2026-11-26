import { Injectable, inject, signal } from '@angular/core';
import { ADMIN_PAGE_SIZE, AdminApi } from './admin-api';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';

export interface Directory {id:string;name:string;code?:string;is_active?:boolean}
export interface CatalogProduct {id:string;sku:string;name:string;category:string;category_id:string;brand:string;presentation:string;price_in_cents:number;status:string;expiry_required:boolean;fractionable:boolean;currency?:string;provenance?:{source:string;classification:string;verified:boolean}}
export interface Presentation {id:string;product_id:string;presentation_code:string;sku:string;factor_base_units:string;price_cents:string;unit_kind:string;active:boolean;authorized_for_receipt:boolean}
export interface UnpackingRule {id:string;product_id:string;source_presentation_id:string;target_presentation_id:string;child_count:string;authorization_reference:string;active:boolean}
interface Page<T>{data:T[];next_cursor:string|null}
export const emptyProductDraft=()=>({name:'',sku:'',presentation:'',category:'',brand:'',price:'',baseUnit:'',factor:'',fractionable:'',expiryRequired:'',requiresPrescription:'',kind:'sealed',status:'draft'});
export type ProductDraft=ReturnType<typeof emptyProductDraft>;

export function priceMinor(value:string):number {
  const normalized=value.replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(normalized))throw new Error('Escribe un precio válido con hasta dos decimales.');
  const [whole,decimal='']=normalized.split('.');const result=BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
  if(result>2147483647n)throw new Error('El precio supera el máximo permitido.');return Number(result);
}

@Injectable({providedIn:'root'})
export class CatalogStore {
  private readonly api=inject(AdminApi);
  readonly categories=signal<Directory[]>([]);readonly brands=signal<Directory[]>([]);readonly baseUnits=signal<Directory[]>([]);
  readonly products=signal<CatalogProduct[]>([]);readonly presentations=signal<Presentation[]>([]);readonly rules=signal<UnpackingRule[]>([]);
  readonly productDraft=signal(emptyProductDraft());readonly loading=signal(false);readonly error=signal('');readonly next=signal<string|null>(null);
  private query='';private generation=0;
  private readonly cancelProductRead = new Subject<void>();
  async references():Promise<void> {
    this.error.set('');
    try {
      const [categories,brands,units,presentations,rules]=await Promise.all(['categories','brands','base-units','presentations','unpacking-rules'].map(resource=>this.all<Directory|Presentation|UnpackingRule>(resource)));
      this.categories.set((categories as Directory[]).filter(value=>value.is_active!==false));this.brands.set((brands as Directory[]).filter(value=>value.is_active!==false));
      this.baseUnits.set(units as Directory[]);this.presentations.set(presentations as Presentation[]);this.rules.set(rules as UnpackingRule[]);
    }catch(error){this.error.set((error as Error).message);}
  }
  private async all<T>(resource:string):Promise<T[]> {
    const rows:T[]=[];let cursor:string|null=null;const seen=new Set<string>();
    do {
      const page:Page<T>=await this.api.get<Page<T>>('catalog/'+resource+'?limit=200'+(cursor?'&after='+encodeURIComponent(cursor):''));
      if(!Array.isArray(page.data)||!(page.next_cursor===null||typeof page.next_cursor==='string'))throw new Error('La respuesta del catálogo no es válida.');
      rows.push(...page.data);cursor=page.next_cursor;if(cursor){if(seen.has(cursor))throw new Error('No se pudo completar la consulta.');seen.add(cursor);}
    }while(cursor);return rows;
  }
  async allProducts():Promise<CatalogProduct[]> {return this.all<CatalogProduct>('products');}
  async editReferences(): Promise<void> {
    const [categories, brands] = await Promise.all([this.all<Directory>('categories'), this.all<Directory>('brands')]);
    this.categories.set(categories.filter(value => value.is_active !== false));
    this.brands.set(brands.filter(value => value.is_active !== false));
  }
  cancelProducts(): void { ++this.generation; this.cancelProductRead.next(); this.loading.set(false); }
  async loadProducts(query='',append=false):Promise<void> {
    this.cancelProducts();
    const generation=this.generation;this.loading.set(true);this.error.set('');
    if(query!==this.query)append=false;this.query=query;
    try {
      const path='catalog/products?limit='+ADMIN_PAGE_SIZE+(query?'&q='+encodeURIComponent(query):'')+(append&&this.next()?'&after='+encodeURIComponent(this.next()!):'');
      const page=await firstValueFrom(this.api.read<Page<CatalogProduct>>(path).pipe(takeUntil(this.cancelProductRead)));
      if(generation!==this.generation)return;
      if(!Array.isArray(page.data))throw new Error('No se pudo leer el catálogo.');
      this.products.set(page.data);this.next.set(page.next_cursor);
    }catch(error){if(generation===this.generation)this.error.set((error as Error).message);}
    finally{if(generation===this.generation)this.loading.set(false);}
  }
  async createDirectory(resource:string,body:{name:string;code?:string}):Promise<void> {await this.api.post('catalog/'+resource,body);await this.references();}
  async createProduct(fields:FormData):Promise<void> {
    const value=(name:string)=>String(fields.get(name)??'');
    for(const field of ['fractionable','expiryRequired','requiresPrescription'])if(!['true','false'].includes(value(field)))throw new Error('Completa las restricciones del producto.');
    const body={name:value('name').trim(),sku:value('sku').trim().toUpperCase(),presentation:value('presentation').trim(),category_id:value('category'),brand_id:value('brand')||null,
      base_unit_id:value('baseUnit'),price_cents:priceMinor(value('price')),status:'draft',requires_prescription:value('requiresPrescription')==='true',
      fractionable:value('fractionable')==='true',expiry_required:value('expiryRequired')==='true',presentation_sku:value('sku').trim().toUpperCase(),
      factor_base_units:value('factor'),unit_kind:value('kind'),authorized_for_sale:false,authorized_for_receipt:true};
    await this.api.post('catalog/products',body);this.productDraft.set(emptyProductDraft());await Promise.all([this.loadProducts(),this.references()]);
  }
  async createPresentation(fields:FormData):Promise<void> {
    const value=(key:string)=>String(fields.get(key)??'');
    await this.api.post('catalog/presentations',{product_id:value('product'),presentation_code:value('presentation'),sku:value('sku').trim().toUpperCase(),
      factor_base_units:value('factor'),price_cents:priceMinor(value('price')),unit_kind:value('kind'),authorized_for_sale:false,authorized_for_receipt:true});
    await this.references();
  }
  async createRule(fields:FormData):Promise<void> {
    const value=(key:string)=>String(fields.get(key)??'');
    await this.api.post('catalog/unpacking-rules',{source_presentation_id:value('source'),target_presentation_id:value('target'),child_count:value('count'),authorization_reference:value('reference').trim()});
    await this.references();
  }
}
