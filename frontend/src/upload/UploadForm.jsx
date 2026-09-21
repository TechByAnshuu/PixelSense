import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadUrl } from './useUploadUrl';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
const MAX_SIZE_MB    = 10;

export default function UploadForm() {
  const navigate = useNavigate();
  const { uploadFile, isLoading, error: uploadError } = useUploadUrl();

  const [dragOver,    setDragOver]    = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [validationErr, setValidationErr] = useState('');

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported file type. Accepted: JPEG, PNG, WebP, GIF, HEIC`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB} MB`;
    }
    return null;
  }

  function handleFileSelect(file) {
    const err = validateFile(file);
    if (err) { setValidationErr(err); setSelectedFile(null); setPreview(null); return; }
    setValidationErr('');
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  const onInputChange = (e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, []);

  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = ()  => setDragOver(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedFile) { setValidationErr('Please select an image first'); return; }
    try {
      const imageId = await uploadFile(selectedFile);
      navigate(`/results/${imageId}`);
    } catch {
      // uploadError state is set by the hook
    }
  }

  return (
    <div className="upload-page">
      <div className="upload-container">
        <div className="page-header">
          <h1>Analyze an Image</h1>
          <p>Drop or select an image — PixelSense will detect objects, faces, text, and generate an AI summary.</p>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Drop zone */}
          <label
            htmlFor="file-input"
            className={`drop-zone ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            aria-label="Image drop zone"
          >
            <input
              id="file-input" type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={onInputChange}
              style={{ display: 'none' }}
            />

            {preview ? (
              <div className="drop-zone-preview">
                <img src={preview} alt="Selected preview" />
                <div className="drop-zone-overlay">
                  <span>Click to change</span>
                </div>
              </div>
            ) : (
              <div className="drop-zone-placeholder">
                <div className="drop-zone-icon" aria-hidden="true">📷</div>
                <p className="drop-zone-label">Drag &amp; drop or <span className="link-text">browse</span></p>
                <p className="drop-zone-hint">JPEG, PNG, WebP, GIF — up to {MAX_SIZE_MB} MB</p>
              </div>
            )}
          </label>

          {selectedFile && (
            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}

          {(validationErr || uploadError) && (
            <div className="alert alert-error" role="alert">
              {validationErr || uploadError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={isLoading || !selectedFile}
          >
            {isLoading ? (
              <><span className="spinner" aria-hidden="true" /> Uploading &amp; analyzing…</>
            ) : (
              <>Analyze Image &rarr;</>
            )}
          </button>
        </form>

        <p className="upload-note">
          Your images are uploaded directly to encrypted cloud storage via a time-limited secure URL.
          Results are stored privately per your account.
        </p>
      </div>
    </div>
  );
}
