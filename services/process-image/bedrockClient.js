/**
 * bedrockClient.js — Amazon Bedrock summary generation
 *
 * Takes structured Rekognition JSON output and generates a concise
 * 2–4 sentence plain-language description of the image via Bedrock.
 *
 * Model: amazon.titan-text-express-v1 (configurable via BEDROCK_MODEL_ID env var)
 * Uses AWS SDK v3: @aws-sdk/client-bedrock-runtime
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const REGION   = process.env.AWS_ACCOUNT_REGION || process.env.AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID   || 'amazon.titan-text-express-v1';

const client = new BedrockRuntimeClient({ region: REGION, maxAttempts: 3 });

/**
 * Build a prompt that feeds Rekognition JSON as context and asks for a summary.
 * @param {{ labels, faces, celebrities, text }} findings
 * @returns {string}
 */
function buildPrompt(findings) {
  const contextJson = JSON.stringify(findings, null, 2);
  return (
    `You are an image analysis assistant. Based on the following AI-detected findings from an image analysis, ` +
    `write a concise plain-language summary of what the image contains. ` +
    `Your summary must be exactly 2 to 4 sentences. Output ONLY the summary text — no preamble, ` +
    `no headings, no bullet points, and no additional commentary.\n\n` +
    `Findings:\n${contextJson}\n\nSummary:`
  );
}

/**
 * Generate a plain-language image summary using Amazon Bedrock.
 *
 * @param {{ labels, faces, celebrities, text }} findings  Structured Rekognition output
 * @returns {Promise<string>}  2–4 sentence plain-language summary
 */
async function generateSummary(findings) {
  const prompt = buildPrompt(findings);

  console.log(JSON.stringify({ level: 'INFO', message: 'Invoking Bedrock', modelId: MODEL_ID }));

  // Titan Text request body
  const requestBody = JSON.stringify({
    inputText: prompt,
    textGenerationConfig: {
      maxTokenCount:   256,
      temperature:     0.4,
      topP:            0.9,
      stopSequences:   [],
    },
  });

  const command = new InvokeModelCommand({
    modelId:     MODEL_ID,
    contentType: 'application/json',
    accept:      'application/json',
    body:        Buffer.from(requestBody),
  });

  let response;
  try {
    response = await client.send(command);
  } catch (err) {
    console.log(JSON.stringify({ level: 'ERROR', message: 'Bedrock invocation failed', error: err.message }));
    throw err; // re-throw — Lambda will fail → SQS retry
  }

  // Parse response body (Uint8Array → string → JSON)
  const rawBody   = Buffer.from(response.body).toString('utf-8');
  const parsed    = JSON.parse(rawBody);
  const summary   = (parsed.results?.[0]?.outputText || '').trim();

  console.log(JSON.stringify({ level: 'INFO', message: 'Bedrock summary generated', charCount: summary.length }));

  return summary;
}

module.exports = { generateSummary };
