import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Video,
  Phone,
  Building
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

interface Meeting {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  meetingType: 'video' | 'in-person' | 'phone';
  meetingUrl?: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  isOrganizer: boolean;
  attendeeStatus: 'organizer' | 'accepted' | 'pending' | 'declined';
  attendeeCount: number;
  organizer: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  color: string;
}

interface CalendarEvent {
  events: Meeting[];
  dateRange: {
    start: string;
    end: string;
  };
  view: string;
  totalEvents: number;
  debug?: any;
}

type ViewType = 'month' | 'week' | 'day';

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [events, setEvents] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDebugInfo] = useState<any>(null);

  // Handle Schedule Meeting button click
  const handleScheduleMeeting = () => {
    navigate('/calendar/schedule');
  };

  // Load calendar events
  const loadEvents = async () => {
    if (!user) {
      console.log('No user found, skipping calendar load');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startDate = getViewStartDate(currentDate, view);
      const endDate = getViewEndDate(currentDate, view);

      const token = localStorage.getItem('business_nexus_token');
      console.log('Token available:', !!token);
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const userId = (user as any)._id;
      if (!userId) {
        setError('User ID not found');
        return;
      }

      console.log('🔍 Frontend Debug - Calendar Request:', {
        currentDate: currentDate.toISOString(),
        view,
        calculatedStart: startDate.toISOString(),
        calculatedEnd: endDate.toISOString(),
        userID: userId,
        tokenExists: !!token
      });

      const response: CalendarEvent = await api(
        `/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&view=${view}`,
        'GET',
        undefined,
        token
      );

      console.log('✅ Backend Response:', {
        totalEvents: response.totalEvents,
        dateRange: response.dateRange,
        events: response.events.map(e => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          status: e.status
        })),
        debug: response.debug
      });

      setEvents(response.events);
      setDebugInfo(response.debug);

    } catch (err: any) {
      console.error('❌ Calendar load error:', err);
      setError(err.message || 'Failed to load calendar events');
      
      if (err.message.includes('Failed to fetch')) {
        setError('Network error - cannot connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate, view, user]);

  // Navigation functions
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Helper functions
  const getViewStartDate = (date: Date, view: ViewType): Date => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    
    switch (view) {
      case 'month':
        return new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), 1));
      case 'week':
        const day = utcDate.getUTCDay();
        const diff = utcDate.getUTCDate() - day;
        return new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), diff));
      case 'day':
        return new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()));
      default:
        return utcDate;
    }
  };

  const getViewEndDate = (date: Date, view: ViewType): Date => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    
    switch (view) {
      case 'month':
        const monthEnd = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, 0));
        monthEnd.setUTCHours(23, 59, 59, 999);
        return monthEnd;
      case 'week':
        const start = getViewStartDate(date, view);
        const weekEnd = new Date(start);
        weekEnd.setUTCDate(start.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);
        return weekEnd;
      case 'day':
        const dayEnd = new Date(utcDate);
        dayEnd.setUTCHours(23, 59, 59, 999);
        return dayEnd;
      default:
        const defaultEnd = new Date(utcDate);
        defaultEnd.setUTCHours(23, 59, 59, 999);
        return defaultEnd;
    }
  };

  const formatDateRange = (): string => {
    const start = getViewStartDate(currentDate, view);
    const end = getViewEndDate(currentDate, view);

    switch (view) {
      case 'month':
        return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'week':
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return '';
    }
  };

  const getMeetingIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video size={14} />;
      case 'phone':
        return <Phone size={14} />;
      case 'in-person':
        return <Building size={14} />;
      default:
        return <CalendarIcon size={14} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      organizer: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      declined: 'bg-red-100 text-red-800'
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">Manage your meetings and appointments</p>
        </div>
        
        <div className="flex space-x-2">
          <Button leftIcon={<Plus />} onClick={handleScheduleMeeting}>
            Schedule Meeting
          </Button>
         <Button 
  leftIcon={<CalendarIcon />} 
  variant="outline" 
  onClick={() => navigate('/calendar/documents')}
>
  Documents
</Button>

        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" onClick={navigatePrevious}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={navigateNext}>
                <ChevronRight size={16} />
              </Button>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{formatDateRange()}</h2>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            {(['month', 'week', 'day'] as ViewType[]).map((viewType) => (
              <Button
                key={viewType}
                variant={view === viewType ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setView(viewType)}
              >
                {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="border rounded-lg">
          {view === 'month' && <MonthView events={events} currentDate={currentDate} />}
          {view === 'week' && <WeekView events={events} currentDate={currentDate} />}
          {view === 'day' && <DayView events={events} currentDate={currentDate} />}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          All Meetings ({events.length})
        </h3>
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CalendarIcon size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No meetings found for this period</p>
            <p className="text-sm text-gray-400 mt-2">
              Try changing the date range or check the debug info above
            </p>
            <Button className="mt-4" leftIcon={<Plus />} onClick={handleScheduleMeeting}>
              Schedule Your First Meeting
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((meeting) => (
              <div key={meeting.id} className="flex items-center p-4 border rounded-lg hover:bg-gray-50">
                <div 
                  className="w-3 h-3 rounded-full mr-3" 
                  style={{ backgroundColor: meeting.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {getMeetingIcon(meeting.meetingType)}
                    <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(meeting.attendeeStatus)}`}>
                      {meeting.attendeeStatus}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      meeting.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                      meeting.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {meeting.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Clock size={14} className="mr-1" />
                      {new Date(meeting.start).toLocaleDateString()} at {new Date(meeting.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {meeting.location && (
                      <div className="flex items-center">
                        <MapPin size={14} className="mr-1" />
                        {meeting.location}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Users size={14} className="mr-1" />
                      {meeting.attendeeCount} attendees
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {meeting.isOrganizer ? 'Organized by you' : `by ${meeting.organizer.name}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Simplified Calendar Views
const MonthView: React.FC<{ events: Meeting[], currentDate: Date }> = ({ events }) => {
  return (
    <div className="p-4 text-center text-gray-500">
      <p>Month View - {events.length} events this month</p>
      <p className="text-sm mt-2">Detailed month grid coming soon...</p>
    </div>
  );
};

const WeekView: React.FC<{ events: Meeting[], currentDate: Date }> = ({ events }) => {
  return (
    <div className="p-4 text-center text-gray-500">
      <p>Week View - {events.length} events this week</p>
      <p className="text-sm mt-2">Detailed week grid coming soon...</p>
    </div>
  );
};

const DayView: React.FC<{ events: Meeting[], currentDate: Date }> = ({ events, currentDate }) => {
  const todayEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate.toDateString() === currentDate.toDateString();
  });

  return (
    <div className="p-4">
      <p className="text-center text-gray-600 mb-4">{todayEvents.length} events today</p>
      {todayEvents.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>No events scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todayEvents.map((meeting) => (
            <div key={meeting.id} className="flex items-center p-3 bg-gray-50 rounded">
              <div 
                className="w-2 h-2 rounded-full mr-3" 
                style={{ backgroundColor: meeting.color }}
              />
              <div className="flex-1">
                <h5 className="font-medium">{meeting.title}</h5>
                <p className="text-sm text-gray-600">
                  {new Date(meeting.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {new Date(meeting.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};