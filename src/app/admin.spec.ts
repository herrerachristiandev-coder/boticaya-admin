import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminApp, adminRoutes } from './admin';

describe('Administrative demo', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(adminRoutes)] });
  });

  async function mount(path: string) {
    const fixture = TestBed.createComponent(AdminApp);
    const router = TestBed.inject(Router);
    await router.navigateByUrl(path);
    await fixture.whenStable();
    return { fixture, router, page: fixture.nativeElement as HTMLElement };
  }

  it('opens the login, enters the demo and returns to the login', async () => {
    const { fixture, router, page } = await mount('/');
    expect(router.url).toBe('/login');
    expect(page.querySelector('input')?.readOnly).toBe(true);
    expect(page.querySelector('input[type=password]')).toBeNull();
    page.querySelector<HTMLAnchorElement>('.primary-button')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/dashboard');
    expect(page.querySelector('h1')?.textContent).toContain('Resumen operativo');
    page.querySelector<HTMLAnchorElement>('.text-link')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/login');
  });

  it('filters demo orders and restores all results', async () => {
    const { fixture, page } = await mount('/dashboard');
    const select = page.querySelector('select')!;
    expect(page.querySelectorAll('tbody tr')).toHaveLength(4);
    select.value = 'pending';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(page.querySelector('tbody')?.textContent).toContain('BY-0124');
    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('toggles the menu and closes it after choosing Inicio', async () => {
    const { fixture, page } = await mount('/dashboard');
    const toggle = page.querySelector<HTMLButtonElement>('.menu-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    page.querySelector<HTMLAnchorElement>('nav a')!.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(page.querySelector('nav a')?.getAttribute('aria-current')).toBe('page');
    expect(page.querySelectorAll('nav a')).toHaveLength(7);
  });

  it('redirects unknown URLs to the demo access page', async () => {
    const { router } = await mount('/ruta-inexistente');
    expect(router.url).toBe('/login');
  });

  it('finds products by SKU and shows an empty state for unknown items', async () => {
    const { page, fixture } = await mount('/productos');
    const search = page.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'by-102';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(page.querySelector('tbody')?.textContent).toContain('Solución salina');
    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    search.value = 'XYZ';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(page.querySelector('tbody')?.textContent).toContain('No hay productos');
  });

  it('combines order code and status filters', async () => {
    const { page, fixture } = await mount('/pedidos');
    const search = page.querySelector('input')!;
    const status = page.querySelector('select')!;
    search.value = 'by-012';
    search.dispatchEvent(new Event('input'));
    status.value = 'pending';
    status.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(page.querySelector('tbody')?.textContent).toContain('BY-0124');
    search.value = 'BY-0122';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(page.querySelector('tbody')?.textContent).toContain('No hay pedidos');
  });

  it('summarizes the demo orders and inventory', async () => {
    const { page } = await mount('/reportes');
    const values = Array.from(page.querySelectorAll('.metric strong'), node => node.textContent?.trim());
    expect(values[0]).toBe('4');
    expect(values[1]).toMatch(/159[.,]80/);
    expect(values[2]).toBe('22');
    expect(page.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('shows configuration values in read-only fields', async () => {
    const { page } = await mount('/configuracion');
    const fields = Array.from(page.querySelectorAll('input'));
    expect(fields).toHaveLength(4);
    expect(fields.every(field => field.readOnly)).toBe(true);
    expect(fields.map(field => field.value)).toContain('admin.boticaya.com');
  });

  it('filters inventory, displays lot movements, and resets filters', async () => {
    const { page, fixture } = await mount('/inventario');
    const search = page.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'BY-102';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(page.querySelectorAll('.record-list details')).toHaveLength(1);
    expect(page.querySelector('.record-list details')?.textContent).toContain('DEM-014');
    const movement = page.querySelector<HTMLSelectElement>('.record-list select')!;
    movement.value = 'entry';
    movement.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    const stock = page.querySelector<HTMLSelectElement>('.module-filters select')!;
    stock.value = 'Agotado';
    stock.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelector('.record-list [role=status]')?.textContent).toContain('No hay productos');
    page.querySelector<HTMLButtonElement>('.module-filters button')!.click();
    await fixture.whenStable();
    expect(page.querySelectorAll('.record-list details')).toHaveLength(4);
  });

  it('creates a product and receives two lots without replacing movements', async () => {
    const { page, fixture, router } = await mount('/productos');
    async function submit(values: Record<string, string>) {
      const form = page.querySelector('form')!;
      for (const [name, value] of Object.entries(values)) {
        const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
        field.value = value;
      }
      form.requestSubmit();
      await fixture.whenStable();
    }
    const product = { name: 'Venda de muestra', sku: 'demo-9', presentation: 'Caja', category: 'Curación', price: '5.50' };
    await submit(product);
    expect(page.querySelector('tbody')?.textContent).toContain('DEMO-9');
    expect(page.querySelector('[role=status]')?.textContent).toContain('«Venda de muestra» creado');
    await submit(product);
    expect(page.querySelector('[role=status]')?.textContent).toContain('ya existe');
    await router.navigateByUrl('/inventario');
    await fixture.whenStable();
    const lot = { sku: 'DEMO-9', lot: 'lote-a', expiry: '2027-06-01', quantity: '12' };
    await submit(lot);
    await submit({ ...lot, quantity: '3' });
    await submit({ ...lot, lot: 'lote-b', quantity: '4' });
    await submit({ ...lot, expiry: '2027-07-01' });
    expect(page.querySelector('[role=status]')?.textContent).toContain('debe coincidir');
    const detail = Array.from(page.querySelectorAll('.record-list details')).find(node => node.textContent?.includes('DEMO-9'))!;
    expect(detail.textContent).toContain('19 unidades');
    expect(detail.textContent).toContain('LOTE-B');
    expect(detail.querySelectorAll('tbody tr')).toHaveLength(3);
    await router.navigateByUrl('/reportes');
    await fixture.whenStable();
    expect(page.querySelectorAll('.metric strong')[2].textContent).toContain('41');
  });

  it('restores the product draft after visiting orders', async () => {
    const { page, fixture, router } = await mount('/productos');
    const form = page.querySelector('form')!;
    const name = form.querySelector<HTMLInputElement>('[name=name]')!;
    const category = form.querySelector<HTMLSelectElement>('[name=category]')!;
    const price = form.querySelector<HTMLInputElement>('[name=price]')!;
    expect(category.value).toBe('');
    expect(price.placeholder).toBe('0,00');
    expect(price.value).toBe('');
    name.value = 'Producto sin guardar';
    name.dispatchEvent(new Event('input'));
    category.value = 'Curación';
    category.dispatchEvent(new Event('change'));
    price.value = '3.50';
    price.dispatchEvent(new Event('input'));
    await router.navigateByUrl('/pedidos');
    await router.navigateByUrl('/productos');
    await fixture.whenStable();
    expect(page.querySelector<HTMLDetailsElement>('.demo-editor')?.open).toBe(true);
    expect(page.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('Producto sin guardar');
    expect(page.querySelector<HTMLSelectElement>('[name=category]')?.value).toBe('Curación');
    expect(page.querySelector<HTMLInputElement>('[name=price]')?.value).toBe('3.50');
  });

  it('shows product help on pointer entry and activation and dismisses it', async () => {
    const { page, fixture } = await mount('/productos');
    const presentation = page.querySelector<HTMLElement>('#presentation-help')!;
    const category = page.querySelector<HTMLElement>('#category-help')!;
    expect(presentation.hidden).toBe(true);
    expect(category.hidden).toBe(true);

    presentation.parentElement!.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(presentation.hidden).toBe(false);
    presentation.parentElement!.dispatchEvent(new MouseEvent('mouseleave'));
    await fixture.whenStable();
    expect(presentation.hidden).toBe(true);

    const button = category.parentElement!.querySelector('button')!;
    button.click();
    await fixture.whenStable();
    expect(category.hidden).toBe(false);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(category.hidden).toBe(true);
  });

  it('consults workers, roles and activity', async () => {
    const { page, fixture } = await mount('/trabajadores');
    expect(page.querySelectorAll('details')).toHaveLength(3);
    const selects = page.querySelectorAll('select');
    selects[1].value = 'Operador';
    selects[1].dispatchEvent(new Event('change'));
    selects[2].value = 'Inactivo';
    selects[2].dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelectorAll('details')).toHaveLength(1);
    selects[0].value = 'roles';
    selects[0].dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelector('.record-list')?.textContent).toContain('ajustar');
    selects[0].value = 'activity';
    selects[0].dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const actor = page.querySelectorAll('select')[1];
    actor.value = 'Luis Vega';
    actor.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelectorAll('.record-list article')).toHaveLength(1);
    expect(page.querySelector('.record-list article')?.textContent).toContain('DEM-014');
  });
});
