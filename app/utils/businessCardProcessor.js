const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ExcelJS = require('exceljs');
const OpenAI = require('openai');
const { saveReceipt } = require('./database');

// Fix logger import and create console fallback
const logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    thirdParty: console.log
};

async function uploadImageAndGetText(file, apiKey) {
    try {
        logger.thirdParty(`Starting Google Vision API request for ${file.originalname}`);
        
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
        const imageContent = file.buffer.toString('base64');
        
        const payload = {
            requests: [{
                image: {
                    content: imageContent
                },
                features: [{
                    type: 'TEXT_DETECTION',
                    maxResults: 1
                }],
                imageContext: {
                    languageHints: ['en']
                }
            }]
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.data.responses?.[0]?.textAnnotations?.[0]?.description) {
            throw new Error('No text detected in image');
        }

        logger.thirdParty(`Successfully processed image ${file.originalname}`);
        return response.data.responses[0].textAnnotations[0].description;
    } catch (error) {
        logger.thirdParty(`Google Vision API request failed for ${file.originalname}`, error.response?.data || error.message);
        throw error;
    }
}

async function structureReceiptDataUsingChatGPT(text, receiptTypes, openaiApiKey) {
    const configuration = new OpenAI.Configuration({
        apiKey: openaiApiKey
    });
    const openai = new OpenAI.OpenAIApi(configuration);

    // Create dynamic JSON structure based on receipt types
    const jsonStructures = receiptTypes.map(type => {
        const fieldStructure = type.fields.reduce((acc, field) => {
            acc[field.name] = field.description || `${field.name} value`;
            return acc;
        }, {});

        return {
            type: type.name,
            fields: fieldStructure
        };
    });

    const prompt = `
    Extract the following receipt information from the given text and return the result as a structured JSON array. 
    Each object in the array should correspond to one of the receipt types provided.
    Only include fields that are actually present in the text, omit fields if no relevant information is found.
    Do not make up or assume any values.
    Do not include anything else, only the JSON array.
    Text:
    ${text}

    Expected Structure:
    [
        ${jsonStructures.map(struct => `{
            "type": "${struct.type}",
            "fields": ${JSON.stringify(struct.fields, null, 4)}
        }`).join(',\n')}
    ]`;

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000,
            temperature: 0,
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error(`Error while processing the request: ${error}`);
        return "Error processing the receipt.";
    }
}

async function processUploadedImages(files, googleApiKey, openaiApiKey, employeeId, receiptTypes = []) {
    const data = [];
    
    logger.info(`Starting to process ${files.length} uploaded images`);
    
    if (!receiptTypes || receiptTypes.length === 0) {
        logger.warn('No receipt types provided, skipping processing');
        return { success: false, message: 'No receipt types available' };
    }
    
    for (const file of files) {
        logger.info(`Processing ${file.originalname}`);
        try {
            const extractedText = await uploadImageAndGetText(file, googleApiKey);
            if (!extractedText) {
                logger.warn(`No text detected in ${file.originalname}`);
                continue;
            }

            const structuredData = await structureReceiptDataUsingChatGPT(
                extractedText, 
                receiptTypes,
                openaiApiKey
            );

            try {
                const jsonData = JSON.parse(structuredData);
                // Add metadata to each receipt type result
                jsonData.forEach(receipt => {
                    receipt.image = file.originalname;
                    receipt.employee_id = employeeId;
                    receipt.created_at = new Date().toISOString();
                });
                
                await saveReceipt(jsonData);
                data.push(...jsonData);
                logger.info(`Successfully processed ${file.originalname}`);
            } catch (error) {
                logger.error(`Invalid JSON format for ${file.originalname}: ${error.message}`);
            }
        } catch (error) {
            logger.error(`Error processing ${file.originalname}: ${error.message}`);
        }
    }

    return { success: true, count: data.length };
}

// Remove processImagesInFolder function if not needed

export { uploadImageAndGetText, structureReceiptDataUsingChatGPT, processUploadedImages };