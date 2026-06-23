import Dashboard from "@/components/Dashboard";
import { getAppConfig } from "@/lib/config";

export default function Page() {
  const config = getAppConfig();
  return <Dashboard initialClubName={config.clubName} initialProvinceOrgId={config.provinceOrgId} />;
}
