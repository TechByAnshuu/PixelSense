/**
 * rekognitionClient.js — All Amazon Rekognition calls
 *
 * Wraps four Rekognition APIs:
 *   - DetectLabels       → objects, scenes, concepts
 *   - DetectFaces        → face attributes
 *   - RecognizeCelebrities → public figure identification
 *   - DetectText         → OCR
 *
 * Each call uses maxAttempts: 3 (SDK v3 built-in retry with exponential backoff).
 */

const {
  RekognitionClient,
  DetectLabelsCommand,
  DetectFacesCommand,
  RecognizeCelebritiesCommand,
  DetectTextCommand,
} = require('@aws-sdk/client-rekognition');

const REGION = process.env.AWS_ACCOUNT_REGION || process.env.AWS_REGION || 'us-east-1';

const client = new RekognitionClient({ region: REGION, maxAttempts: 3 });

/**
 * Run all four Rekognition analyses on a single S3 image.
 *
 * @param {string} bucket  S3 bucket name
 * @param {string} key     S3 object key
 * @returns {Promise<{ labels, faces, celebrities, text }>}
 */
async function analyzeImage(bucket, key) {
  const imageSource = { S3Object: { Bucket: bucket, Name: key } };

  console.log(JSON.stringify({ level: 'INFO', message: 'Starting Rekognition analysis', bucket, key }));

  const [labelsResult, facesResult, celebResult, textResult] = await Promise.allSettled([
    client.send(new DetectLabelsCommand({
      Image: imageSource,
      MaxLabels: 20,
      MinConfidence: 70,
    })),
    client.send(new DetectFacesCommand({
      Image: imageSource,
      Attributes: ['ALL'],
    })),
    client.send(new RecognizeCelebritiesCommand({
      Image: imageSource,
    })),
    client.send(new DetectTextCommand({
      Image: imageSource,
    })),
  ]);

  // Extract values — if a call failed, log it but don't throw (partial results are still useful)
  const extract = (result, transform) => {
    if (result.status === 'fulfilled') return transform(result.value);
    console.log(JSON.stringify({ level: 'WARN', message: 'Rekognition call failed', error: result.reason?.message }));
    return [];
  };

  const labels = extract(labelsResult, (v) =>
    (v.Labels || []).map((l) => ({
      name:       l.Name,
      confidence: Math.round(l.Confidence),
      categories: (l.Categories || []).map((c) => c.Name),
    }))
  );

  const faces = extract(facesResult, (v) =>
    (v.FaceDetails || []).map((f) => ({
      confidence:   Math.round(f.Confidence),
      ageRange:     f.AgeRange,
      gender:       f.Gender?.Value,
      emotions:     (f.Emotions || [])
                      .filter((e) => e.Confidence > 50)
                      .map((e) => ({ type: e.Type, confidence: Math.round(e.Confidence) })),
      eyeglasses:   f.Eyeglasses?.Value,
      sunglasses:   f.Sunglasses?.Value,
      smile:        f.Smile?.Value,
    }))
  );

  const celebrities = extract(celebResult, (v) =>
    (v.CelebrityFaces || []).map((c) => ({
      name:       c.Name,
      confidence: Math.round(c.MatchConfidence),
      urls:       c.Urls || [],
    }))
  );

  const text = extract(textResult, (v) =>
    (v.TextDetections || [])
      .filter((t) => t.Type === 'LINE')
      .map((t) => ({
        detectedText: t.DetectedText,
        confidence:   Math.round(t.Confidence),
      }))
  );

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Rekognition complete',
    labelCount:     labels.length,
    faceCount:      faces.length,
    celebCount:     celebrities.length,
    textLineCount:  text.length,
  }));

  return { labels, faces, celebrities, text };
}

module.exports = { analyzeImage };
