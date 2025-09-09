
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Dashboard Pages
import { EntrepreneurDashboard } from './pages/dashboard/EntrepreneurDashboard';
import { InvestorDashboard } from './pages/dashboard/InvestorDashboard';

// Profile Pages
import { EntrepreneurProfile } from './pages/profile/EntrepreneurProfile';
import { InvestorProfile } from './pages/profile/InvestorProfile';

// Feature Pages
import { InvestorsPage } from './pages/investors/InvestorsPage';
import { EntrepreneursPage } from './pages/entrepreneurs/EntrepreneursPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { HelpPage } from './pages/help/HelpPage';
import { DealsPage } from './pages/deals/DealsPage';

// Calendar Pages
import { CalendarPage } from './pages/calendar/CalendarPage';
import { ScheduleMeetingPage } from './pages/calendar/ScheduleMeetingPage';
import DocumentPage from './pages/calendar/DocumentPage';



// Chat Pages
import { ChatPage } from './pages/chat/ChatPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route path="entrepreneur" element={<EntrepreneurDashboard />} />
              <Route path="investor" element={<InvestorDashboard />} />
            </Route>
          </Route>
          
          {/* Protected Profile Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<DashboardLayout />}>
              <Route path="entrepreneur/:id" element={<EntrepreneurProfile />} />
              <Route path="investor/:id" element={<InvestorProfile />} />
            </Route>
          </Route>
          
       {/* Protected Calendar Route */}
<Route element={<ProtectedRoute />}>
  <Route path="/calendar" element={<DashboardLayout />}>
    <Route index element={<CalendarPage />} />
    <Route path="schedule" element={<ScheduleMeetingPage />} />
    <Route path="documents" element={<DocumentPage />} /> {/* relative path */}
  </Route>
</Route>

          
          {/* Protected Feature Routes - These should be at root level */}
          <Route element={<ProtectedRoute />}>
            <Route path="/investors" element={<DashboardLayout />}>
              <Route index element={<InvestorsPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/entrepreneurs" element={<DashboardLayout />}>
              <Route index element={<EntrepreneursPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/messages" element={<DashboardLayout />}>
              <Route index element={<MessagesPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/notifications" element={<DashboardLayout />}>
              <Route index element={<NotificationsPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/documents" element={<DashboardLayout />}>
              <Route index element={<DocumentsPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/settings" element={<DashboardLayout />}>
              <Route index element={<SettingsPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/help" element={<DashboardLayout />}>
              <Route index element={<HelpPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/deals" element={<DashboardLayout />}>
              <Route index element={<DealsPage />} />
            </Route>
          </Route>
          
          {/* Protected Chat Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/chat" element={<DashboardLayout />}>
              <Route index element={<ChatPage />} />
              <Route path=":userId" element={<ChatPage />} />
            </Route>
          </Route>
          
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all other routes and redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;