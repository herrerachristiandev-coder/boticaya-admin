import { Injectable, computed, signal } from '@angular/core';

const referenceDate = '2026-11-19';
const seed = [
  { sku: 'BY-101', name: 'Alcohol en gel 500 ml', threshold: 5, lot: 'DEM-011', expiry: '2027-03-12', received: 20, dispatched: 17 },
  { sku: 'BY-102', name: 'Solución salina', threshold: 5, lot: 'DEM-014', expiry: '2026-12-07', received: 24, dispatched: 10 },
  { sku: 'BY-103', name: 'Gasa estéril', threshold: 5, lot: 'DEM-018', expiry: '2027-07-06', received: 20, dispatched: 15 },
  { sku: 'BY-104', name: 'Vendas elásticas', threshold: 3, lot: 'DEM-022', expiry: '2026-11-16', received: 12, dispatched: 12 },
];

interface Product {
  sku: string;
  name: string;
  presentation: string;
  category: string;
  price: number | null;
  threshold: number;
  lots: readonly Lot[];
}

interface Lot {
  code: string;
  expiry: string;
  movements: readonly Movement[];
}

interface Movement {
  date: string;
  type: 'entry' | 'exit';
  quantity: number;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class DemoInventory {
  readonly productDraft = signal({ name: '', sku: '', presentation: '', category: '', price: '' });

  private readonly records = signal<readonly Product[]>(seed.map(product => ({
    sku: product.sku, name: product.name, threshold: product.threshold,
    presentation: '', category: '', price: null,
    lots: [{
      code: product.lot, expiry: product.expiry,
      movements: [
        { date: '2026-11-01', type: 'entry', quantity: product.received, reason: 'Recepción' },
        { date: '2026-11-18', type: 'exit', quantity: product.dispatched, reason: 'Pedidos' },
      ],
    }],
  })));

  readonly products = computed(() => this.records().map(product => {
    const lots = product.lots.map(lot => ({
      ...lot,
      stock: lot.movements.reduce((total, movement) => total + (movement.type === 'entry' ? movement.quantity : -movement.quantity), 0),
      expiryState: lot.expiry < referenceDate ? 'Vencido' : lot.expiry <= '2026-12-19' ? 'Vence pronto' : 'Vigente',
    }));
    const stock = lots.reduce((total, lot) => total + lot.stock, 0);
    const state = stock === 0 ? 'Agotado' : stock <= product.threshold ? 'Stock bajo' : 'Disponible';
    return { ...product, lots, stock, state };
  }));

  addProduct({ sku, name, presentation, category, price }: Omit<Product, 'threshold' | 'lots'>): string {
    sku = sku.trim().toUpperCase();
    name = name.trim();
    presentation = presentation.trim();
    category = category.trim();
    if (!sku || !name || !presentation || !category || price === null || !Number.isFinite(price) || price <= 0) {
      return 'Completa la ficha con un precio mayor que cero.';
    }
    if (this.records().some(product => product.sku === sku)) return 'Ese SKU ya existe en el catálogo.';
    this.records.update(products => [...products, { sku, name, presentation, category, price, threshold: 0, lots: [] }]);
    return '';
  }

  receive(sku: string, code: string, expiry: string, quantity: number): string {
    code = code.trim().toUpperCase();
    const date = new Date(expiry);
    if (!code || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== expiry || expiry <= referenceDate) {
      return 'Ingresa un lote, una cantidad entera positiva y un vencimiento posterior al 19/11/2026.';
    }
    const product = this.records().find(item => item.sku === sku);
    if (!product) return 'Selecciona un producto del catálogo.';
    const lot = product.lots.find(item => item.code === code);
    if (lot && lot.expiry !== expiry) return 'El vencimiento debe coincidir con el del lote registrado.';
    const movement: Movement = { date: referenceDate, type: 'entry', quantity, reason: 'Recepción de muestra' };
    const lots = lot
      ? product.lots.map(item => item === lot ? { ...lot, movements: [...lot.movements, movement] } : item)
      : [...product.lots, { code, expiry, movements: [movement] }];
    this.records.update(products => products.map(item => item === product ? { ...product, lots } : item));
    return '';
  }
}
