import { validateInstallContext } from './scripts/check-install-context.ts';

const INSTALL_COMMANDS = new Set(['i', 'install']);
const PASSTHROUGH_COMMANDS = new Set([
  'create',
  'dlx',
  'exec',
  'run',
  'run-script',
]);

const isPnpmInstallCommand = (arguments_) => {
  const passthroughIndex = arguments_.findIndex((argument) =>
    PASSTHROUGH_COMMANDS.has(argument),
  );
  const pnpmArguments =
    passthroughIndex === -1
      ? arguments_
      : arguments_.slice(0, passthroughIndex);

  return pnpmArguments.some((argument) => INSTALL_COMMANDS.has(argument));
};

export const hooks = {
  updateConfig(config) {
    const isInstall = isPnpmInstallCommand(process.argv.slice(2));

    if (!isInstall) return config;

    const [error] = validateInstallContext(process.env.MISE_TASK_NAME);
    if (error) throw new Error(error);

    return config;
  },
};
