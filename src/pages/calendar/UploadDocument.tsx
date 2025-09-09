// src/pages/calendar/UploadDocument.tsx
import React, { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { api } from '../../api';

export const UploadDocument: React.FC<{ onUpload: () => void }> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  if (!event.target.files || event.target.files.length === 0) return;

  const formData = new FormData();
  for (let i = 0; i < event.target.files.length; i++) {
    formData.append('documents', event.target.files[i]); // backend expects "documents"
  }

  formData.append('name', 'My Document');
  formData.append('description', 'Uploaded from frontend');
  formData.append('tags', JSON.stringify(['frontend', 'test']));

  setUploading(true);
  try {
    const token = localStorage.getItem('business_nexus_token');
    if (!token) throw new Error('Not logged in');

    const response = await api('/documents/upload', 'POST', formData, token);
    console.log('Uploaded document', response);

    // ✅ Open the first uploaded document in a new tab via documentId
  if (response.documents && response.documents.length > 0) {
  const fileUrl = response.documents[0].fileUrl; // e.g. /uploads/documents/file.pdf
  window.open(`http://localhost:5000${fileUrl}`, '_blank'); // opens in new tab
}


    onUpload(); // refresh document list
  } catch (err: any) {
    console.error('Upload failed', err);
    alert(err.message || 'Upload failed');
  } finally {
    setUploading(false);
  }
};



  return (
    <>
      <Button onClick={handleClick} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Document'}
      </Button>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  );
};
