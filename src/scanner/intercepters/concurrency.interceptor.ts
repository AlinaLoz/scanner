import { Sema } from "async-sema";
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  UseInterceptors,
} from "@nestjs/common";
import { Observable } from "rxjs";

export const globalSemaphore = new Sema(2);

@Injectable()
export class ConcurrencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ConcurrencyInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    this.logger.debug(
      `Attempting to acquire semaphore for ${className}.${methodName}`,
    );

    return new Observable((observer) => {
      (async () => {
        await globalSemaphore.acquire();
        this.logger.debug(`Semaphore acquired for ${className}.${methodName}`);
        try {
          const result = await next.handle().toPromise();
          observer.next(result);
          observer.complete();
        } catch (error) {
          observer.error(error);
        } finally {
          globalSemaphore.release();
          this.logger.debug(
            `Semaphore released for ${className}.${methodName}`,
          );
        }
      })();
    });
  }
}

export function ConcurrencyLimit() {
  return UseInterceptors(ConcurrencyInterceptor);
}
