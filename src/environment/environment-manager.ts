import { red } from '../utils/command-line-colors.js';
import development from './development.json' assert { type: 'json' };
import production from './production.json' assert { type: 'json' };

const configuration = {
    development,
    production
};
const env = process.env.NODE_ENV;
const disableExtensions = process.argv.slice(2)[0]?.split('=')[1] === 'true';

if (env === undefined) {
    throw new Error(red('Environment not specified'));
}
if (!['development', 'production'].includes(env)) {
    throw new Error(red(`Unknown environment '${env}'`));
}

const environment = {
    ...configuration[env as 'development' | 'production'],
    env: env,
    disableExtensions
};

export { environment };
