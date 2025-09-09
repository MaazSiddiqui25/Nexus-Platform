import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { FileText } from 'lucide-react';
import { UploadDocument } from './UploadDocument';
// adjust path if needed



interface DocumentType {
  _id: string;
  name: string;
  fileType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  uploadedBy: {
    name: string;
    email: string;
  };
  tags: string[];
  status: string;
  userPermission: 'view' | 'edit' | 'sign';
}

export const DocumentPage: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('business_nexus_token') || undefined;
const response = await api('/documents?page=1&limit=50', 'GET', undefined, token);

      setDocuments(response.documents);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-4">{error}</div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Documents</h1>
        <UploadDocument onUpload={loadDocuments} />

      </div>

      {documents.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 text-gray-400" />

          <p>No documents found</p>
          <Button className="mt-4" onClick={() => alert('Open upload modal')}>
            Upload Your First Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div key={doc._id} className="border rounded-lg p-4 flex flex-col hover:shadow-md transition">
              <div className="flex items-center mb-2">
                {doc.thumbnailUrl ? (
                  <img src={doc.thumbnailUrl || undefined} alt={doc.name} className="w-12 h-12 object-cover rounded mr-2" />

                ) : (
                  <FileText size={48} className="mx-auto mb-4" />

                )}
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">{doc.name}</h2>
                  <p className="text-sm text-gray-500">{doc.fileType.toUpperCase()}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Uploaded by: {doc.uploadedBy.name} ({doc.uploadedBy.email})
              </p>
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {doc.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm font-medium mb-2">
                Status: <span className="capitalize">{doc.status}</span>
              </p>
              <div className="mt-auto flex justify-between items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(doc.fileUrl, '_blank')}
                >
                  View
                </Button>
                {doc.userPermission !== 'view' && (
                  <Button size="sm" variant="secondary" onClick={() => alert('Open signature/edit modal')}>
                    {doc.userPermission === 'sign' ? 'Sign' : 'Edit'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentPage;
