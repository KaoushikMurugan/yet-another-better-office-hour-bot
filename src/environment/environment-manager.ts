import { red } from '../utils/command-line-colors.js';
import development from './development.json' with { type: 'json' };
import production from './production.json' with { type: 'json' };

const configuration = {
    development,
    production
};
const possibleEnvironments = ['development', 'production'] as const;
const env = process.env.NODE_ENV as (typeof possibleEnvironments)[number]; // checked
const disableExtensions = process.argv.slice(2)[0]?.split('=')[1] === 'true';

// this is necessary
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (env === undefined) {
    throw new Error(red('Environment not specified'));
}
if (!possibleEnvironments.includes(env)) {
    throw new Error(red(`Unknown environment '${env}'`));
}

const environment = { ...configuration[env], env: env, disableExtensions };

export { environment };
