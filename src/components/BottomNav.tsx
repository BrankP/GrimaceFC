import { NavLink } from 'react-router-dom';

const links = [
  { to: '/upcoming', label: 'Upcoming' },
  { to: '/fines', label: 'Fines' },
  { to: '/chat', label: 'Chat' },
  { to: '/game', label: 'Next Game' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
