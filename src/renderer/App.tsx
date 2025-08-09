import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';
import EVEAuth from './components/EVEAuth';

function EVEInventoryApp() {
  return (
    <div className="app-container">
      <div className="Hello">
        <img width="100" alt="icon" src={icon} />
      </div>
      <h1>EVE Online Inventory Manager</h1>
      <EVEAuth />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EVEInventoryApp />} />
      </Routes>
    </Router>
  );
}
