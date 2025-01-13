import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { logError, logInfo } from './utils.js';

dotenv.config();

const BIGCOMMERCE_API_STORE_HASH = process.env.BIGCOMMERCE_API_STORE_HASH;
const BIGCOMMERCE_API_ACCESS_TOKEN = process.env.BIGCOMMERCE_API_ACCESS_TOKEN;
const INDEX_NOW_API_KEY = process.env.INDEX_NOW_API_KEY;
const INDEX_NOW_KEY_LOCATION_URL = process.env.INDEX_NOW_KEY_LOCATION_URL;
const BASE_URL = process.env.BASE_URL;

export async function submitToIndexNow(urlList) {
    if (!Array.isArray(urlList) || urlList.length === 0) {
        logError("Invalid or empty URL list provided. Skipping IndexNow submission.");
        return false;
    }

    if (!INDEX_NOW_API_KEY) {
        logError("IndexNow API key is not defined. Skipping IndexNow submission.");
        return false;
    }

    try {
        const payload = {
            host: new URL(BASE_URL).hostname,
            key: INDEX_NOW_API_KEY,
            keyLocation: INDEX_NOW_KEY_LOCATION_URL,
            urlList: urlList
        };

        const response = await fetch('https://api.indexnow.org/IndexNow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            logInfo('Successfully submitted to IndexNow:', urlList);
            return true;
        } else {
            logError('Error submitting to IndexNow:', response.status, response.statusText);
            const responseBody = await response.text();
            logError('IndexNow Response Body:', responseBody);

            if (response.status === 400) {
                logError("Possible reasons: Invalid API key, incorrect URL format, exceeding URL limit.");
            } else if (response.status === 403) {
                logError("Forbidden. Ensure your API key is valid and correctly configured.");
            } else if (response.status === 422) {
                logError("Unprocessable Entity. In case of URLs don’t belong to the host or the key is not matching the schema in the protocol.");
            } else if (response.status === 429) {
                logError("Too Many Requests. You might be hitting the rate limit.");
            }
            return false;
        }
    } catch (error) {
        logError('Error submitting to IndexNow:', error);
        return false;
    }
}

export async function getCategoryUrlById(categoryId) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/catalog/categories/${categoryId}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Token': BIGCOMMERCE_API_ACCESS_TOKEN
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const category = await response.json();
        const urlPath = category.data.custom_url.url;
        const fullUrl = `${BASE_URL}${urlPath}`;
        logInfo('Get Category URL by ID = ', fullUrl);
        return fullUrl;
    } catch (error) {
        logError('Error fetching category:', error);
        throw error;
    }
}

export async function getProductUrlById(productId) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/catalog/products/${productId}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Token': BIGCOMMERCE_API_ACCESS_TOKEN
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        const urlPath = product.data.custom_url.url;
        const fullUrl = `${BASE_URL}${urlPath}`;
        return fullUrl;
    } catch (error) {
        logError('Error fetching product:', error);
        throw error;
    }
}

export async function getPageUrlById(pageId) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/content/pages/${pageId}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Token': BIGCOMMERCE_API_ACCESS_TOKEN
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const page = await response.json();
        const urlPath = page.data.url;
        const fullUrl = `${BASE_URL}${urlPath}`;
        return fullUrl;
    } catch (error) {
        logError('Error fetching page:', error);
        throw error;
    }
}