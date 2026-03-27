import { ProcurementStageModule } from "./ProcurementStageModule";

export function POModule() {
  return (
    <ProcurementStageModule
      config={{
        frontendStage: "PO",
        title: "Purchase Order",
        description: "PO line items",
        multiUpload: false,
        uploadLabel: "Upload PO Document",
        changeLabel: "Change Document",
        viewLabel: "View Document",
      }}
    />
  );
}
