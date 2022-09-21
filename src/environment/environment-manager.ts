import development from './development.json';
import production from './production.json';

const configuration = {
    development,
    production
};
const possibleEnvironments = ['development', 'production'];
const mode = process.env.NODE_ENV as ('development' | 'production');

if (mode === undefined) {
    throw new Error('Environment not specified');
}
if (!possibleEnvironments.includes(mode)) {
    throw new Error(`Unknwon environment ${mode}`);
}

export default { ...configuration[mode], mode };