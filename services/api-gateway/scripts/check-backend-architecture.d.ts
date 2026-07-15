declare module '@repo/architecture-checker' {
  export interface TBackendArchitectureOptions {
    root: string;
    featureRoot?: string;
    requireAbsoluteImports?: boolean;
    allowedApplicationRoots?: readonly string[];
    forbiddenFeatureOuterRoots?: readonly string[];
    forbiddenRootRuntimeModules?: readonly string[];
    runtimeIdentifiers?: readonly string[];
    sharedRoot?: string;
    sharedForbiddenLocalRoots?: readonly string[];
    sharedForbiddenPackages?: readonly string[];
  }

  export function checkBackendArchitecture(
    options: TBackendArchitectureOptions,
  ): Promise<string[]>;

  export function printArchitectureResult(options: {
    label: string;
    violations: readonly string[];
  }): void;
}
