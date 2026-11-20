"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../login/actions";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/panitia", label: "Committee" },
  { href: "/admin/log", label: "Attendance log" },
  { href: "/admin/manual", label: "Manual check-in" },
  { href: "/admin/scan", label: "Scan QR" },
  { href: "/admin/qr", label: "QR codes" },
];

export function AdminNav() {
  const pathname = usePathname();

  return LINKS.map(({ href, label }) => {
    const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`nav-link shrink-0 ${active ? "nav-link-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </Link>
    );
  });
}

export function SignOut() {
  return (
    <form action={logout}>
      <button className="btn btn-quiet w-full justify-start" type="submit">
        Sign out
      </button>
    </form>
  );
}
