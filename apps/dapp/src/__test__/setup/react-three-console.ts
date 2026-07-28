import { afterEach, beforeEach, vi } from 'vitest';

const REACT_THREE_TAGS = new Set([
  'ambientLight',
  'group',
  'mesh',
  'meshBasicMaterial',
  'meshPhysicalMaterial',
  'pointLight',
  'sphereGeometry',
  'torusGeometry',
]);
const REACT_THREE_PROPS = new Set([
  'clearcoatRoughness',
  'depthWrite',
  'emissiveIntensity',
  'renderOrder',
  'toneMapped',
  'transparent',
]);
// biome-ignore lint/suspicious/noConsole: unexpected errors must retain Vitest's original console reporting.
const originalConsoleError = console.error.bind(console);
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

const isExpectedReactThreeDomWarning = (
  message: unknown,
  substitutions: unknown[],
): boolean => {
  if (typeof message !== 'string') return false;

  if (
    (message.startsWith('<%s /> is using incorrect casing') ||
      message.startsWith('The tag <%s> is unrecognized')) &&
    REACT_THREE_TAGS.has(String(substitutions[0]))
  ) {
    return true;
  }

  if (
    message.startsWith('React does not recognize the `%s` prop') &&
    REACT_THREE_PROPS.has(String(substitutions[0]))
  ) {
    return true;
  }

  return (
    message.startsWith('Received `%s` for a non-boolean attribute `%s`') &&
    REACT_THREE_PROPS.has(String(substitutions[1]))
  );
};

beforeEach(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((message: unknown, ...substitutions: unknown[]) => {
      if (!isExpectedReactThreeDomWarning(message, substitutions)) {
        originalConsoleError(message, ...substitutions);
      }
    });
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});
