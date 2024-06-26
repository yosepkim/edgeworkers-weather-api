import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';
import { EdgeKV } from './edgekv.js';
import URLSearchParams from 'url-search-params';

async function getResponse(url) {
    const response = await httpRequest(`${url}`);
    if (response.ok) {
        return await response.json();
    } else {
        return {
            error: `Failed to return ${url}`
        };
    }
}

function buildResponse(httpCode, returnData) {
    return createResponse(
        httpCode, {
            'Content-Type': ['application/json']
        },
        JSON.stringify(returnData)
    );
}

function objectEmptyOrNull(obj) {
    return obj == null || Object.keys(obj).length === 0;
}

export async function responseProvider(request) {
    try {
        const currentWeatherUrl = 'https://cars.edgecloud9.com/api/weather/current';

        // Initializing the EdgeKV client
        const database = new EdgeKV({namespace: "weather-data", group: "0"});

        // Getting query variables from URL
        const params = new URLSearchParams(request.query);
        const locationKey = params.get('locationKey')
        const language = params.get('language')
        const unit = params.get('unit'); 

        const translation = await database.getJson({ item: 'translation' });
        if (objectEmptyOrNull(translation)) {
            return buildResponse(404, { "errorMessage": "Translation data is missing" });
        }

        let currentWeather = await database.getJson({ item: locationKey });
        if (objectEmptyOrNull(currentWeather)) {
            currentWeather = await getResponse(currentWeatherUrl); 
            database.putJsonNoWait({ item: locationKey, value: currentWeather });
        }

        // language augmentation
        currentWeather["localizedCondition"] = translation[language][currentWeather["condition"]];
        currentWeather["localizedWindGusts"] = translation[language]["wind-gusts"];
        currentWeather["localizedAirQuality"] = translation[language]["air-quality"];
        currentWeather["localizedAirQualityOption"] = translation[language]["quality-options"][currentWeather.airQuality];

        currentWeather["temperatureUnit"] = unit;
        if (unit === "C") {
            currentWeather["temperature"] = (currentWeather.temperature - 32) * 5/9;
        }
        return buildResponse(200, currentWeather);
    } catch(exception) {
        return buildResponse(500, { "exception": exception.toString() });
    }
}