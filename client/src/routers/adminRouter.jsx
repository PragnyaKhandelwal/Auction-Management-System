import { AdminLayout } from "../layout/AdminLayout";
import { AdminDashboard } from "../pages/Admin/AdminDashboard";
import { FairPlay } from "../pages/Admin/FairPlay";
import { UsersList } from "../pages/Admin/UsersList";

export const adminRouter = [
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminDashboard />,
      },
      {
        path: "users",
        element: <UsersList />,
      },
      {
        path: "fair-play",
        element: <FairPlay />,
      },
    ],
  },
];
