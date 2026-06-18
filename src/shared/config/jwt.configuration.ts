import { env } from './env.configuration';

const PROJECT_NAME = env.client.NEXT_PUBLIC_PROJECT_NAME!;

const jwt = {
  accessToken: {
    key: `${PROJECT_NAME}_access_token`,
    config: {
      maxAge: 60 * 60 * 24, // 1 day
      httpOnly: false,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax' as const,
      domain:
        process.env.NODE_ENV === 'development'
          ? undefined
          : env.client.NEXT_PUBLIC_CORS_COOKIE!,
    },
  },
  refreshToken: {
    key: `${PROJECT_NAME}_refresh_token`,
    config: {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax' as const,
      domain:
        process.env.NODE_ENV === 'development'
          ? undefined
          : env.client.NEXT_PUBLIC_CORS_COOKIE!,
    },
  },
};

export { jwt };
