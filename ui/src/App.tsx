import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

import SubmitApplication from "./pages/SubmitApplication";
import HowToUse from "./pages/howToUse";

export default function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Header />

        {/* Main content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<SubmitApplication />} />
            <Route path="/how-to-use" element={<HowToUse />} />
            
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
