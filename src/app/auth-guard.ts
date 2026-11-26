import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

export const adminGuard: CanActivateChildFn = async (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return await session.restore() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
