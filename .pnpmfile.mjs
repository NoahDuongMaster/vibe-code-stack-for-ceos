import { validateInstallContext } from './scripts/check-install-context.mjs';

const INSTALL_COMMANDS = new Set(['i', 'install']);

export const hooks = {
  updateConfig(config) {
    const isInstall = process.argv
      .slice(2)
      .some((argument) => INSTALL_COMMANDS.has(argument));

    if (!isInstall) return config;

    const [error] = validateInstallContext(process.env.MISE_TASK_NAME);
    if (error) throw new Error(error);

    return config;
  },
};
