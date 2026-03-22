/**
 * App.jsx — Định tuyến trang (pages) — mở rộng khi làm module.
 */
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
