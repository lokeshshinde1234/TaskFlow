import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header({ onLogout, user }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    setShowMenu(false);
    onLogout();
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg fixed w-full top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <h1
              className="text-2xl font-bold text-white cursor-pointer"
              onClick={() => navigate('/employee-dashboard')}
            >
              TaskFlow
            </h1>
          </div>

          <div className="hidden md:flex space-x-8">
            <button
              onClick={() => navigate('/employee-dashboard')}
              className="text-white hover:text-blue-100 transition font-medium"
            >
              Home
            </button>
            <button
              onClick={() => navigate('/employee-dashboard')}
              className="text-white hover:text-blue-100 transition font-medium"
            >
              Projects
            </button>
            <button
              onClick={() => navigate('/employee-dashboard')}
              className="text-white hover:text-blue-100 transition font-medium"
            >
              Tasks
            </button>
            <button
              onClick={() => navigate('/employee-dashboard')}
              className="text-white hover:text-blue-100 transition font-medium"
            >
              Team
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center space-x-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition"
            >
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              <span className="hidden sm:inline">{user?.first_name}</span>
              <svg
                className={`w-4 h-4 transition ${showMenu ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-gray-800 font-semibold">{user?.first_name} {user?.last_name}</p>
                  <p className="text-gray-600 text-sm">{user?.email}</p>
                  <p className="text-gray-600 text-sm">{user?.department}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition font-semibold border-t border-gray-200"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          <button className="md:hidden text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
