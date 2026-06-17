import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME } from "@/lib/adminAuth";

import AdminDashboardClient from "./AdminDashboardClient";
import AdminLoginForm from "./AdminLoginForm";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AdminPage(props: AdminPageProps) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const expectedSecret = process.env.ADMIN_SECRET?.trim() ?? "";
  const query = await props.searchParams;
  const providedSecret = readSearchParam(query.secret).trim();

  const cookieStore = await cookies();
  const cookieSecret = cookieStore.get(ADMIN_COOKIE_NAME)?.value?.trim() ?? "";

  const secretMatches = (value: string) =>
    Boolean(expectedSecret) && value === expectedSecret;

  const isAuthorized =
    isDevelopment || secretMatches(providedSecret) || secretMatches(cookieSecret);

  if (!isAuthorized) {
    return <AdminLoginForm configured={Boolean(expectedSecret)} />;
  }

  return <AdminDashboardClient adminSecret={cookieSecret || providedSecret} />;
}
