import { ProcurementStageModule } from "./ProcurementStageModule";

export function PRModule() {
  return (
    <ProcurementStageModule
      config={{
        frontendStage: "PR",
        title: "Purchase Requisition",
        description: "PR line items",
        multiUpload: true,
        uploadLabel: "Upload PR Documents",
        changeLabel: "Change Documents",
        viewLabel: "View Documents",
      }}
    />
  );
}
