import development from './development.json' assert { type: 'json' };
import production from './production.json' assert { type: 'json' };

const configuration = {
    development,
    production
};
const possibleEnvironments = ['development', 'production'];
const env = process.env.NODE_ENV as 'development' | 'production';
const disableExtensions = process.argv.slice(2)[0]?.split('=')[1] === 'true';

if (env === undefined) {
    throw new Error('Environment not specified');
}
if (!possibleEnvironments.includes(env)) {
    throw new Error(`Unknwon environment ${env}`);
}

const environment = { ...configuration[env], env: env, disableExtensions };

export { environment };
