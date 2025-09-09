import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { useNavigate } from 'react-router-dom';

interface MeetingFormData {
  title: string;
  description?: string;
  attendeeIds: string[];
  startTime: string;
  endTime: string;
  timezone: string;
  meetingType: 'video' | 'in-person' | 'phone';
  location?: string;
  agenda: string[];
  reminder: {
    enabled: boolean;
    minutes: number;
  };
}

export const ScheduleMeetingPage: React.FC = () => {
  useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<MeetingFormData>({
    title: '',
    description: '',
    attendeeIds: [],
    startTime: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    meetingType: 'video',
    location: '',
    agenda: [],
    reminder: { enabled: true, minutes: 15 }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resolveUserIdsFromEmails = async (identifiers: string[], token: string): Promise<string[]> => {
  if (identifiers.length === 0) return [];
  const response = await api('/users/lookup', 'POST', { identifiers }, token);
  if (response && Array.isArray(response.users)) {
    return response.users.map((u: any) => u._id);
  }
  throw new Error('Failed to resolve user IDs');
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (!form.title || !form.startTime || !form.endTime || form.attendeeIds.length === 0) {
    setError('Title, start time, end time, and at least one attendee are required');
    return;
  }

  setLoading(true);
  try {
    const token = localStorage.getItem('business_nexus_token');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Resolve usernames/emails in attendeeIds to user IDs
    const userIds = await resolveUserIdsFromEmails(form.attendeeIds, token);

    const payload = {
      ...form,
      attendeeIds: userIds,
    };

    const response = await api('/meetings', 'POST', payload, token);
    if (response.message === 'Meeting created successfully') {
      navigate('/calendar');
    } else {
      setError(response.message || 'Failed to create meeting');
    }
  } catch (err: any) {
    setError(err.message || 'Failed to create meeting');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Schedule a Meeting</h2>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1" htmlFor="title">Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            value={form.title}
            onChange={handleInputChange}
            className="input"
            placeholder="Meeting title"
          />
        </div>

        <div>
          <label className="block font-medium mb-1" htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleInputChange}
            className="input"
            placeholder="Brief description"
          />
        </div>

        <div>
         <label className="block font-medium mb-1" htmlFor="attendeeIds">
  Attendees (Usernames or Emails, comma separated) *
</label>
<input
  id="attendeeIds"
  name="attendeeIds"
  type="text"
  required
  value={form.attendeeIds.length > 0 ? form.attendeeIds.join(', ') : ''}
  onChange={(e) => setForm((prev) => ({
    ...prev,
    attendeeIds: e.target.value.split(',').map(id => id.trim())
  }))}
  className="input"
  placeholder="e.g. user1@example.com, user2, someone@example.com"
/>

        </div>

        <div>
          <label className="block font-medium mb-1" htmlFor="startTime">Start Time *</label>
          <input
            id="startTime"
            name="startTime"
            type="datetime-local"
            required
            value={form.startTime}
            onChange={handleInputChange}
            className="input"
          />
        </div>

        <div>
          <label className="block font-medium mb-1" htmlFor="endTime">End Time *</label>
          <input
            id="endTime"
            name="endTime"
            type="datetime-local"
            required
            value={form.endTime}
            onChange={handleInputChange}
            className="input"
          />
        </div>

        <div>
          <label className="block font-medium mb-1" htmlFor="timezone">Timezone</label>
          <input
            id="timezone"
            name="timezone"
            type="text"
            value={form.timezone}
            onChange={handleInputChange}
            className="input"
            placeholder="e.g. America/New_York"
          />
        </div>

        <div>
          <label className="block font-medium mb-1" htmlFor="meetingType">Meeting Type</label>
          <select
            id="meetingType"
            name="meetingType"
            value={form.meetingType}
            onChange={handleInputChange}
            className="input"
          >
            <option value="video">Video</option>
            <option value="in-person">In-Person</option>
            <option value="phone">Phone</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1" htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            type="text"
            value={form.location}
            onChange={handleInputChange}
            className="input"
            placeholder="Physical location if applicable"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Scheduling...' : 'Schedule Meeting'}
        </button>
      </form>
    </div>
  );
};
