import AdminDashboardClient from "./AdminDashboardClient";

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

  const isAuthorized =
    isDevelopment ||
    (Boolean(expectedSecret) && Boolean(providedSecret) && providedSecret === expectedSecret);

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 text-center shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Not authorized.</h1>
        </div>
      </main>
    );
  }

  return <AdminDashboardClient adminSecret={providedSecret} />;
}
