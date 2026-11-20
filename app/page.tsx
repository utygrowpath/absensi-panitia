import { redirect } from "next/navigation";

// `/` is forwarded to the admin area by `redirects` in next.config.ts.
export default function Home() {
  redirect("/admin");
}
