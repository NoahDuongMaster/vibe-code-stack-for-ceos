import { status } from '@grpc/grpc-js';
import { Injectable, type PipeTransform } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AUTHENTICATION_RPC_ERROR_MESSAGES } from '@/features/authentication/adapters/authentication.rpc-errors';
import {
  type TLoginRequest,
  ZLoginRequest,
} from '@/features/authentication/adapters/login.schema';

@Injectable()
export class LoginGrpcPipe implements PipeTransform<unknown, TLoginRequest> {
  transform(value: unknown): TLoginRequest {
    const parsed = ZLoginRequest.safeParse(value);
    if (!parsed.success) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: AUTHENTICATION_RPC_ERROR_MESSAGES.invalidRequest,
      });
    }
    return parsed.data;
  }
}
