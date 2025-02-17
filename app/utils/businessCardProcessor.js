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
    Analyze this receipt and respond with ONLY a JSON object in this exact format:
    {
        "fields": {
            "receipt_type_id": (number matching one of the IDs below),
            "field1": "value1",
            "field2": "value2"
        }
    }

    Receipt Text:
    ${text}

    Available Types and Fields:
    ${receiptTypes.map(type => `Type ${type.id}: ${type.name}
    Required Fields: ${type.fields.map(f => f.name).join(', ')}`).join('\n')}`;

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{ 
                role: "system", 
                content: "You are a JSON generator. Output ONLY valid JSON without any explanation or markdown." 
            }, { 
                role: "user", 
                content: prompt 
            }],
            max_tokens: 1000,
            temperature: 0,
        });

        let content = response.data.choices[0].message.content.trim();
        
        // Remove any non-JSON text
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        content = content.slice(jsonStart, jsonEnd);
        
        // Validate JSON
        JSON.parse(content);
        
        return content;
    } catch (error) {
        console.error(`Error while processing the request: ${error}`);
        throw error;
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
                let jsonData = JSON.parse(structuredData);
                if (!Array.isArray(jsonData)) {
                    jsonData = [jsonData];
                }
                
                // Add metadata to each receipt
                jsonData.forEach(receipt => {
                    // Log the filename to verify its value
                    console.log(`Filename for ${file.originalname}:`, file.filename);
                    
                    // Ensure all required fields are set
                    receipt.image_path = file.filename || 'default_filename'; // Use a default if undefined
                    receipt.employee_id = parseInt(employeeId, 10); // Convert to integer
                    receipt.created_at = new Date().toISOString();
                    receipt.receipt_type_id = receipt.fields.receipt_type_id;
                    receipt.data = JSON.stringify(receipt.fields);
                    delete receipt.fields;

                    // Log the receipt data to verify all fields
                    console.log(`Receipt data for ${file.originalname}:`, receipt);
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