import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { ComparePage } from "../features/compare/ComparePage";
import { ExplorePage } from "../features/explore/ExplorePage";
import { MissionDetailPage, MissionsPage } from "../features/missions/MissionsPage";
import { PlanProvider } from "./PlanProvider";

export function App() {
  return (
    <BrowserRouter>
      <PlanProvider>
        <AppShell>
          <Routes>
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/missions" element={<MissionsPage />} />
            <Route path="/missions/:missionId" element={<MissionDetailPage />} />
            <Route path="*" element={<Navigate replace to="/explore" />} />
          </Routes>
        </AppShell>
      </PlanProvider>
    </BrowserRouter>
  );
}
