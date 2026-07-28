import { Controller, Inject, UseFilters } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import { AuthGrpcExceptionFilter } from '@/features/authentication/adapters/grpc/auth.grpc-exception.filter';
import { LoginGrpcPipe } from '@/features/authentication/adapters/grpc/login.grpc.pipe';
import type {
  Login,
  TLoginInput,
  TLoginResult,
} from '@/features/authentication/application/login.port';
import { LOGIN } from '@/features/authentication/authentication.tokens';

@Controller()
@UseFilters(AuthGrpcExceptionFilter)
export class AuthGrpcController {
  private readonly login: Login;

  constructor(@Inject(LOGIN) _login: Login) {
    this.login = _login;
  }

  @GrpcMethod('AuthService', 'Login')
  loginRpc(
    @Payload(LoginGrpcPipe) request: TLoginInput,
  ): Promise<TLoginResult> {
    return this.login.execute(request);
  }
}
