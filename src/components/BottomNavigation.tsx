// ============================================================
// Small, shared mobile navigation for authenticated primary pages.
// ============================================================

import { NavLink } from 'react-router-dom';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/question?mode=change', label: 'Voice input', icon: 'voice' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
] as const;

type NavigationIcon = typeof items[number]['icon'];

function NavigationIcon({ name }: { name: NavigationIcon }) {
  if (name === 'dashboard') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1" /><rect x="14" y="14" width="6.5" height="6.5" rx="1" /></svg>;
  }
  if (name === 'voice') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8.5" y="3" width="7" height="11" rx="3.5" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" /></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1.3-3.6 4-5.4 7.5-5.4s6.2 1.8 7.5 5.4" /></svg>;
}

export default function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Main navigation">
      {items.map(item => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-navigation-item ${isActive ? 'bottom-navigation-item-active' : ''}`}>
          <span className="bottom-navigation-icon"><NavigationIcon name={item.icon} /></span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
