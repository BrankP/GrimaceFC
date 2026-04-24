import { NavLink } from 'react-router-dom';

const links = [
  { to: '/upcoming', label: 'Upcoming' },
  { to: '/chat', label: 'Chat' },
  { to: '/game', label: 'Next Game' },
  { to: '/next-ref', label: 'Next Ref' },
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
