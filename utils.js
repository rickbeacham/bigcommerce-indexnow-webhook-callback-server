// utils.js
export function validateEnvVariables(requiredEnvVars) {
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            throw new Error(`${varName} is not defined in the environment variables.`);
        }
    });
}

export function logError(message, ...args) {
    console.error(message, ...args);
}

export function logInfo(message, ...args) {
    console.log(message, ...args);
}
