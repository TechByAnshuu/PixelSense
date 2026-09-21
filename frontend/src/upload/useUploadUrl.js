/**
 * useUploadUrl.js
 *
 * React hook — calls POST /uploads to get a presigned S3 URL,
 * then PUTs the file directly to S3 using that URL.
 *
 * Returns: { getUploadUrl, uploadToS3, isLoading, error }
 */

import { useState, useCallback } from 'react';
import apiClient from '../api/apiClient';

export function useUploadUrl() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);

  /**
   * Request a presigned upload URL from the backend.
   * @param {string} fileName
   * @param {string} contentType
   * @returns {Promise<{ uploadUrl: string, imageId: string }>}
   */
  const getUploadUrl = useCallback(async (fileName, contentType) => {
    setError(null);
    const response = await apiClient.post('/uploads', { fileName, contentType });
    return response.data;
  }, []);

  /**
   * PUT a file directly to S3 using the presigned URL.
   * @param {string} presignedUrl
   * @param {File} file
   */
  const uploadToS3 = useCallback(async (presignedUrl, file) => {
    // Use native fetch — Axios would add auth headers that break presigned URLs
    const res = await fetch(presignedUrl, {
      method:  'PUT',
      body:    file,
      headers: { 'Content-Type': file.type },
    });

    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
    }
  }, []);

  /**
   * Combined: get URL + upload file in one call.
   * @param {File} file
   * @returns {Promise<string>} imageId
   */
  const uploadFile = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const { uploadUrl, imageId } = await getUploadUrl(file.name, file.type);
      await uploadToS3(uploadUrl, file);
      return imageId;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getUploadUrl, uploadToS3]);

  return { uploadFile, getUploadUrl, uploadToS3, isLoading, error };
}
