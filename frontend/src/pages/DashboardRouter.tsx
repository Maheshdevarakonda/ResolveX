import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./admin/AdminDashboard";
import CustomerDashboard from "./customer/CustomerDashboard";
import EmployeeDashboard from "./employee/EmployeeDashboard";

export default function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <AdminDashboard />;
  if (user?.role === "EMPLOYEE") return <EmployeeDashboard />;
  return <CustomerDashboard />;
}
