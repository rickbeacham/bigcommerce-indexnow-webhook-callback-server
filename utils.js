// utils.js
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

export function validateEnvVariables(requiredEnvVars) {
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            throw new Error(`Environment variable ${varName} is not defined. Please check your configuration.`);
        }
    });
}

export function logError(message, ...args) {
    logger.error(message, ...args);
}

export function logInfo(message, ...args) {
    logger.info(message, ...args);
}
