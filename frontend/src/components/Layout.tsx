import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ThemeToggle } from "./ThemeToggle";

const COLLAPSED_KEY = "sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

function Sidebar({ className = "", collapsed = false, onToggleCollapsed, onNavigate }: SidebarProps) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${collapsed ? "flex justify-center" : "block"} rounded-md px-3 py-2 text-sm transition ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
    }`;

  return (
    <aside
      className={`sticky top-0 flex h-dvh shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-300 dark:border-gray-700 dark:bg-gray-800 ${
        collapsed ? "w-14" : "w-64"
      } ${className}`}
    >
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-2">
        <div className={`mb-4 flex items-center px-2 pt-2 ${collapsed ? "flex-col gap-1" : "justify-between"}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Espandi sidebar"
            >
              <span className="text-xl" aria-hidden="true">💰</span>
            </button>
          ) : (
            <>
              <h1 className="whitespace-nowrap text-lg font-bold text-gray-900 dark:text-gray-100">
                <NavLink to="/" end className="transition-opacity hover:opacity-80">
                  💰 Finance Tracker
                </NavLink>
              </h1>
              {onToggleCollapsed && (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  aria-label="Comprimi sidebar"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        <nav className="space-y-1" onClick={onNavigate}>
          <NavLink to="/" end className={linkClass} title={collapsed ? "Progetti" : undefined}>
            <span aria-hidden="true" className={collapsed ? "" : "mr-2"}>📁</span>
            {!collapsed && "Progetti"}
          </NavLink>
        </nav>
      </div>

      <div className={`py-4 ${collapsed ? "flex justify-center px-0" : "px-4"}`}>
        <ThemeToggle compact={collapsed} />
      </div>
    </aside>
  );
}

// Layout principale: sidebar + header con menu utente + area contenuti.
export function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!v));
      } catch {
        /* storage non disponibile */
      }
      return !v;
    });
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  useEffect(() => {
    if (!userMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [userMenuOpen]);

  const menuItemClass =
    "block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700";

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Sidebar className="hidden lg:flex" collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <Sidebar className="absolute inset-y-0 left-0 z-50 max-w-[85%] shadow-xl" onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-md border border-gray-300 p-2 text-lg leading-none dark:border-gray-600 lg:hidden"
            aria-label="Apri menu di navigazione"
          >
            ☰
          </button>

          <div className="relative ml-auto" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Menu utente"
              aria-expanded={userMenuOpen}
            >
              <span className="text-xl leading-none">👤</span>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => {
                    setChangingPassword(true);
                    setUserMenuOpen(false);
                  }}
                  className={menuItemClass}
                >
                  🔑 Cambia password
                </button>
                <button onClick={handleLogout} className={menuItemClass}>
                  🚪 Esci
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  );
}
