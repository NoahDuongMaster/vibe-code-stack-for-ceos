import { Request } from '@/shared/lib/xhr';

export abstract class BaseService {
  protected readonly request: Request;

  constructor() {
    this.request = new Request();
  }
}
