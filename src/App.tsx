import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import UploadPage from "./pages/UploadPage";
import EmployeesPage from "./pages/EmployeesPage";
import ReportsPage from "./pages/ReportsPage";
import HistoryPage from "./pages/HistoryPage";
import RealtimePage from "./pages/RealtimePage";
import ReportsRangePage from "./pages/ReportsRangePage";
import ReportsDayPage from "./pages/ReportsDayPage";
import ReportsMonthPage from "./pages/ReportsMonthPage";
import ReportsYearPage from "./pages/ReportsYearPage";
import DepartmentPage from "./pages/DepartmentPage";
import DepartmentsListPage from "./pages/DepartmentsListPage";
import ComparePage from "./pages/ComparePage";
import WeeklyTemporaryWorkersPage from "./pages/WeeklyTemporaryWorkersPage";
import HrReportPage from "./pages/HrReportPage";
import RevisionHistoryPage from "./pages/RevisionHistoryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Cache data trong 5 phút
      refetchOnWindowFocus: false, // Không refetch khi focus lại window
      retry: 2, // Retry 2 lần nếu fail
      retryDelay: 1000, // Đợi 1 giây giữa các lần retry
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <I18nProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/realtime" element={<RealtimePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/new" element={<EmployeesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/day" element={<ReportsDayPage />} />
            <Route path="/reports/month" element={<ReportsMonthPage />} />
            <Route path="/reports/year" element={<ReportsYearPage />} />
            <Route path="/reports/range" element={<ReportsRangePage />} />
            <Route path="/reports/compare" element={<ComparePage />} />
            <Route path="/reports/weekly-temporary-workers" element={<WeeklyTemporaryWorkersPage />} />
            <Route path="/hr/:reportType" element={<HrReportPage />} />
            <Route path="/departments" element={<DepartmentsListPage />} />
            <Route path="/departments/:dept" element={<DepartmentPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/revision-history" element={<RevisionHistoryPage />} />
          </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
