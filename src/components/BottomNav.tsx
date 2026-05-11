import { NavLink } from 'react-router-dom';

const links = [
  { to: '/upcoming', label: 'Events' },
  { to: '/chat', label: 'Chat' },
  { to: '/game', label: 'Game' },
  { to: '/next-ref', label: 'Ref' },
  { to: '/team-stats', label: 'Stats' },
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
