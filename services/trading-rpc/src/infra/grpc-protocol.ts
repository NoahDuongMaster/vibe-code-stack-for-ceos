import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROTO_FILES = [
  ['health', 'v1', 'health.proto'],
  ['trading', 'v1', 'trading.proto'],
] as const;

const resolveProtoFile = (segments: readonly string[]): string => {
  const relativePath = segments.join('/');
  const bundledPath = fileURLToPath(
    new URL(`./proto/${relativePath}`, import.meta.url),
  );
  if (existsSync(bundledPath)) return bundledPath;

  const workspacePath = fileURLToPath(
    new URL(
      `../../../../packages/protocol/proto/${relativePath}`,
      import.meta.url,
    ),
  );
  if (existsSync(workspacePath)) return workspacePath;

  throw new Error(`Missing Protobuf contract asset: ${relativePath}`);
};

export const resolveGrpcProtoPaths = (): string[] =>
  PROTO_FILES.map(resolveProtoFile);
