import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { DocumentUploads } from "./components/DocumentUploads";
import { Reports } from "./components/Reports";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "documents", Component: DocumentUploads },
      { path: "reports", Component: Reports },
    ],
  },
]);