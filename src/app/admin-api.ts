import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, defer, finalize, firstValueFrom, shareReplay, throwError } from 'rxjs';
import { AuthSession } from './auth-session';

export interface CursorPage<T> { data: T[]; next_cursor: string | null }
export const ADMIN_PAGE_SIZE = 10;

@Injectable({providedIn:'root'})
export class AdminApi {
  private readonly http=inject(HttpClient);
  private readonly session=inject(AuthSession);
  private readonly router=inject(Router);
  private readonly commands=new Map<string,{body:string;key:string}>();
  private readonly reads = new Map<string, Observable<unknown>>();

  read<T>(path: string): Observable<T> {
    return defer(() => {
      const active = this.reads.get(path);
      if (active) return active as Observable<T>;
      const request = this.http.get<T>('/api/admin/v1/' + path, { timeout: 12000 }).pipe(
        catchError(error => throwError(() => this.failure(error))),
        finalize(() => this.reads.delete(path)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.reads.set(path, request);
      return request;
    });
  }

  get<T>(path: string): Promise<T> { return firstValueFrom(this.read<T>(path)); }
  post<T>(path:string,body:unknown):Promise<T> { return this.write('POST',path,body); }
  patch<T>(path:string,body:unknown):Promise<T> { return this.write('PATCH',path,body); }
  private async write<T>(method:'POST'|'PATCH',path:string,body:unknown):Promise<T> {
    const commandPath=method+' '+path;
    const serialized=JSON.stringify(body);let command=this.commands.get(commandPath);
    if(!command||command.body!==serialized){command={body:serialized,key:crypto.randomUUID()};this.commands.set(commandPath,command);}
    try {
      const result=await firstValueFrom(this.http.request<T>(method,'/api/admin/v1/'+path,{body,timeout:15000,headers:new HttpHeaders({'X-Botica-Request':'admin','Idempotency-Key':command.key})}));
      if(this.commands.get(commandPath)===command)this.commands.delete(commandPath);return result;
    }catch(error){throw this.failure(error);}
  }
  private failure(error:unknown):Error {
    const status=error instanceof HttpErrorResponse?error.status:0;
    const code=error instanceof HttpErrorResponse?error.error?.error:undefined;
    if(status===401){this.session.user.set(null);void this.router.navigateByUrl('/login');}
    return new Error(status===401?'La sesión venció. Vuelve a iniciar sesión.':status===403?'Tu cuenta no tiene permiso para esta operación.'
      :status===501?'Esta función espera la activación de la extensión 021 en el backend.'
      :status===404?'El recurso solicitado no está disponible.'
      :code==='version_or_idempotency_conflict'?'El registro cambió o existe un conflicto. Recarga el detalle antes de volver a editar.'
      :status===409?'Ya existe un registro con esos datos o la solicitud está en conflicto.'
      :status===400?'Revisa los campos y las presentaciones autorizadas.':'No se pudo completar la operación. Revisa la conexión y vuelve a intentar.');
  }
}
