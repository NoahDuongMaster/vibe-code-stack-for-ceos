import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import { z } from 'zod';

const ZDeployEnvironment = z.enum(['staging', 'production']);
const ZServiceId = z
  .string()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const ZDeployInputs = z.object({
  GATEWAY_CORS_ORIGINS: z.string().trim().min(1),
  TRADING_RPC_VPC_SERVICE_ID: ZServiceId,
  ADMIN_RPC_VPC_SERVICE_ID: ZServiceId,
});
const ZWranglerConfig = z
  .object({
    env: z.record(
      z.string(),
      z
        .object({ vars: z.record(z.string(), z.unknown()).optional() })
        .passthrough(),
    ),
  })
  .passthrough();

export type TGatewayDeployEnvironment = z.infer<typeof ZDeployEnvironment>;
export type TGatewayDeployInputs = z.infer<typeof ZDeployInputs>;

const normalizeCorsOrigins = (rawOrigins: string): string => {
  const origins = [
    ...new Set(
      rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ];
  if (origins.length === 0 || origins.includes('*')) {
    throw new Error('GATEWAY_CORS_ORIGINS must be an explicit allow-list');
  }

  return origins
    .map((origin) => {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error(`Invalid gateway CORS origin: ${origin}`);
      }
      return url.origin;
    })
    .join(',');
};

export const createGatewayDeployConfig = (
  source: string,
  environmentInput: string,
  input: Record<string, string | undefined>,
): Record<string, unknown> => {
  const environment = ZDeployEnvironment.parse(environmentInput);
  const values = ZDeployInputs.parse(input);
  const parseErrors: ParseError[] = [];
  const parsedSource: unknown = parse(source, parseErrors, {
    allowTrailingComma: true,
  });
  if (parseErrors.length > 0) {
    throw new Error(
      `Invalid wrangler.jsonc: ${parseErrors
        .map((error) => printParseErrorCode(error.error))
        .join(', ')}`,
    );
  }

  const config = ZWranglerConfig.parse(parsedSource);
  const target = config.env[environment];
  if (!target) throw new Error(`Missing wrangler environment: ${environment}`);

  config.env[environment] = {
    ...target,
    vars: {
      ...target.vars,
      CORS_ORIGINS: normalizeCorsOrigins(values.GATEWAY_CORS_ORIGINS),
    },
    vpc_services: [
      {
        binding: 'TRADING_RPC',
        service_id: values.TRADING_RPC_VPC_SERVICE_ID,
        remote: true,
      },
      {
        binding: 'ADMIN_RPC',
        service_id: values.ADMIN_RPC_VPC_SERVICE_ID,
        remote: true,
      },
    ],
  };

  return config;
};

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(resolve(entrypoint)).href) {
  const environment = ZDeployEnvironment.parse(process.argv[2]);
  const serviceRoot = resolve(import.meta.dirname, '..');
  const config = createGatewayDeployConfig(
    readFileSync(resolve(serviceRoot, 'wrangler.jsonc'), 'utf8'),
    environment,
    process.env,
  );
  const outputDirectory = resolve(serviceRoot, '.wrangler');
  const outputPath = resolve(outputDirectory, `deploy-${environment}.json`);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  process.stdout.write(`${outputPath}\n`);
}
