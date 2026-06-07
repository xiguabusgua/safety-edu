import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Submit from './pages/Submit';
import Progress from './pages/Progress';
import Result from './pages/Result';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminQuestions from './pages/AdminQuestions';
import MyTasks from './pages/MyTasks';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';
import Health from './pages/Health';
import SiteHeader from './components/SiteHeader';

export default function App() {
  return (
    <>
      <SiteHeader />
      <div id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/submit/:platform" element={<Submit />} />
          <Route path="/task/:taskId" element={<Progress />} />
          <Route path="/result/:taskId" element={<Result />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/health" element={<Health />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/questions" element={<AdminQuestions />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  );
}
