'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="floating-navbar">
      <div className="navbar-links">
        <Link href="/" className={`navbar-item ${pathname === '/' ? 'active' : ''}`}>
          Map
        </Link>
        <Link href="/how-it-works" className={`navbar-item ${pathname === '/how-it-works' ? 'active' : ''}`}>
          How it works
        </Link>
      </div>
    </nav>
  );
}
