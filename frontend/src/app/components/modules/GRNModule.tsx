import { ProcurementStageModule } from "./ProcurementStageModule";

export function GRNModule() {
  return (
    <ProcurementStageModule
      config={{
        frontendStage: "GRN",
        title: "Goods Receipt Note",
        description: "GRN line items",
        multiUpload: false,
        uploadLabel: "Upload GRN Document",
        changeLabel: "Change Document",
        viewLabel: "View Document",
      }}
    />
  );
}
