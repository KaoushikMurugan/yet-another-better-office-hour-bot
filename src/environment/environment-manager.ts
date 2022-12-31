import { red } from '../utils/command-line-colors.js';
import development from './development.json' assert { type: 'json' };
import production from './production.json' assert { type: 'json' };

const configuration = {
    development,
    production
};
const possibleEnvironments = ['development', 'production'] as const;
const env = process.env.NODE_ENV as typeof possibleEnvironments[number]; // checked
const disableExtensions = process.argv.slice(2)[0]?.split('=')[1] === 'true';

if (env === undefined) {
    throw new Error(red('Environment not specified'));
}
if (!possibleEnvironments.includes(env)) {
    throw new Error(red(`Unknown environment '${env}'`));
}

const environment = { ...configuration[env], env: env, disableExtensions };

export { environment };
