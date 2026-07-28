const REQUIRED_ENVIRONMENT = [
  'SMOKE_ADMIN_EMAIL',
  'SMOKE_ADMIN_PASSWORD',
  'SMOKE_ADMIN_URL',
  'SMOKE_DAPP_EMAIL',
  'SMOKE_DAPP_PASSWORD',
  'SMOKE_DAPP_URL',
  'SMOKE_GATEWAY_URL',
  'SMOKE_LANDING_URL',
] as const;

type TRequiredEnvironmentName = (typeof REQUIRED_ENVIRONMENT)[number];

const readEnvironment = (): Record<TRequiredEnvironmentName, string> =>
  Object.fromEntries(
    REQUIRED_ENVIRONMENT.map((name) => {
      const value = process.env[name]?.trim();
      if (!value)
        throw new Error(`Missing required deployment smoke value: ${name}`);
      return [name, value];
    }),
  ) as Record<TRequiredEnvironmentName, string>;

const normalizedOrigin = (value: string): string => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported smoke URL protocol: ${url.protocol}`);
  }
  return url.toString().replace(/\/$/u, '');
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchWithRetry = async (
  input: string,
  init?: RequestInit,
): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(attempt * 2_000);
  }
  throw new Error(
    `Deployment smoke request failed: ${new URL(input).pathname}`,
    {
      cause: lastError,
    },
  );
};

const connectRpc = async (
  gateway: string,
  path: string,
  body: unknown,
  token?: string,
): Promise<unknown> => {
  const response = await fetchWithRetry(`${gateway}${path}`, {
    method: 'POST',
    headers: {
      'connect-protocol-version': '1',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return response.json();
};

const readToken = (value: unknown): string => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    value.token.length === 0
  ) {
    throw new Error('Admin login smoke response did not contain a token');
  }
  return value.token;
};

const assertMarkets = (value: unknown, service: string): void => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('markets' in value) ||
    !Array.isArray(value.markets) ||
    value.markets.length === 0
  ) {
    throw new Error(`${service} smoke response did not contain market data`);
  }

  const first = value.markets[0];
  if (
    typeof first !== 'object' ||
    first === null ||
    !('imageUrl' in first) ||
    typeof first.imageUrl !== 'string' ||
    first.imageUrl.length === 0
  ) {
    throw new Error(
      `${service} smoke response did not contain a coin image URL`,
    );
  }
};

const main = async () => {
  const environment = readEnvironment();
  const admin = normalizedOrigin(environment.SMOKE_ADMIN_URL);
  const dapp = normalizedOrigin(environment.SMOKE_DAPP_URL);
  const gateway = normalizedOrigin(environment.SMOKE_GATEWAY_URL);
  const landing = normalizedOrigin(environment.SMOKE_LANDING_URL);

  await Promise.all([
    fetchWithRetry(admin),
    fetchWithRetry(dapp),
    fetchWithRetry(landing),
    fetchWithRetry(`${gateway}/healthz`),
  ]);

  const dappLogin = await fetchWithRetry(`${dapp}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: environment.SMOKE_DAPP_EMAIL,
      password: environment.SMOKE_DAPP_PASSWORD,
    }),
  });
  if (!dappLogin.headers.get('set-cookie')) {
    throw new Error('Dapp login smoke response did not set a session cookie');
  }

  const login = await connectRpc(gateway, '/auth.v1.AuthService/Login', {
    email: environment.SMOKE_ADMIN_EMAIL,
    password: environment.SMOKE_ADMIN_PASSWORD,
  });
  const token = readToken(login);
  const marketRequest = { coinIds: ['bitcoin'], vsCurrency: 'usd' };
  const [tradingMarkets, adminMarkets] = await Promise.all([
    connectRpc(gateway, '/trading.v1.TradingService/GetMarkets', marketRequest),
    connectRpc(
      gateway,
      '/admin.v1.AdminService/GetMarkets',
      marketRequest,
      token,
    ),
  ]);
  assertMarkets(tradingMarkets, 'TradingService');
  assertMarkets(adminMarkets, 'AdminService');

  process.stdout.write('Deployment smoke checks passed\n');
};

await main();

export {};
