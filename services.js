// services.js
import fetch from 'node-fetch';
import { logError, logInfo } from './utils.js';

async function bigCommerceApiFetch(path, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/${path}`;
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
            const message = `BigCommerce API Error: ${response.status} at ${url}`;
            logError(message);
            throw new Error(message);
        }
        return await response.json();
    } catch (error) {
        logError(`Error fetching from BigCommerce API: ${error.message}`);
        throw error;
    }
}

export async function submitToIndexNow(urlList, INDEX_NOW_API_KEY, INDEX_NOW_KEY_LOCATION_URL, BASE_URL) {
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
            try {
                const responseBody = await response.text();
                logError('IndexNow Response Body:', responseBody);
            } catch (err) {
                logError('Failed to read IndexNow response body:', err);
            }

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

export async function getCategoryUrlById(categoryId, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN, BASE_URL) {
    if (!categoryId || !BIGCOMMERCE_API_STORE_HASH || !BIGCOMMERCE_API_ACCESS_TOKEN || !BASE_URL) {
        throw new Error('Invalid input parameters in getCategoryUrlById');
    }
    try {
        const category = await bigCommerceApiFetch(`catalog/categories/${categoryId}`, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN);
        const urlPath = category.data.custom_url.url;
        const fullUrl = `${BASE_URL}${urlPath}`;
        logInfo('Get Category URL by ID = ', fullUrl);
        return fullUrl;
    } catch (error) {
        logError(`Error fetching category with ID ${categoryId}: ${error.message}`);
        throw error;
    }
}

export async function getProductUrlById(productId, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN, BASE_URL) {
    if (!productId || !BIGCOMMERCE_API_STORE_HASH || !BIGCOMMERCE_API_ACCESS_TOKEN || !BASE_URL) {
        throw new Error('Invalid input parameters in getProductUrlById');
    }
    try {
        const product = await bigCommerceApiFetch(`catalog/products/${productId}`, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN);
        const urlPath = product.data.custom_url.url;
        const fullUrl = `${BASE_URL}${urlPath}`;
        logInfo('Get Product URL by ID = ', fullUrl);
        return fullUrl;
    } catch (error) {
        logError(`Error fetching product with ID ${productId}: ${error.message}`);
        throw error;
    }
}

export async function getPageUrlById(pageId, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN, BASE_URL) {
    if (!pageId || !BIGCOMMERCE_API_STORE_HASH || !BIGCOMMERCE_API_ACCESS_TOKEN || !BASE_URL) {
        throw new Error('Invalid input parameters in getPageUrlById');
    }
    try {
        const page = await bigCommerceApiFetch(`content/pages/${pageId}`, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN);
        const urlPath = page.data.url;
        const fullUrl = `${BASE_URL}${urlPath}`;
        logInfo('Get Page URL by ID = ', fullUrl);
        return fullUrl;
    } catch (error) {
        logError(`Error fetching page with ID ${pageId}: ${error.message}`);
        throw error;
    }
}