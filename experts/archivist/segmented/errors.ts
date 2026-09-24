export class SegmentedArchivistError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SegmentedArchivistError";
    this.code = code;
  }
}

export class SourcePinMismatchError extends SegmentedArchivistError {
  constructor(field: string) {
    super(`source_pin_mismatch:${field}`, `RECKONING_PILOT_PIN_MISMATCH:${field}`);
    this.name = "SourcePinMismatchError";
  }
}

export class StructuralUnitError extends SegmentedArchivistError {
  constructor(message: string) {
    super("structural_units_unreconciled", message);
    this.name = "StructuralUnitError";
  }
}

export class CoverageIncompleteError extends SegmentedArchivistError {
  constructor(message: string) {
    super("coverage_incomplete", message);
    this.name = "CoverageIncompleteError";
  }
}

export class CertifiedModelMismatchError extends SegmentedArchivistError {
  constructor(message: string) {
    super("certified_model_mismatch", message);
    this.name = "CertifiedModelMismatchError";
  }
}

export class CheckpointIncompatibleError extends SegmentedArchivistError {
  constructor(reason: string) {
    super("checkpoint_incompatible", reason);
    this.name = "CheckpointIncompatibleError";
  }
}

export class DuplicateSegmentedResumeError extends SegmentedArchivistError {
  constructor(message = "duplicate active segmented resume is not allowed") {
    super("duplicate_active_resume", message);
    this.name = "DuplicateSegmentedResumeError";
  }
}

export class SegmentedPublicationBlockedError extends SegmentedArchivistError {
  constructor(message: string) {
    super("publication_blocked", message);
    this.name = "SegmentedPublicationBlockedError";
  }
}

export class SegmentedExecutionUnauthorizedError extends SegmentedArchivistError {
  constructor(message = "segmented Archivist run is not authorized") {
    super("not_authorized", message);
    this.name = "SegmentedExecutionUnauthorizedError";
  }
}

export class PaidPilotUnauthorizedError extends SegmentedArchivistError {
  constructor(reason: string) {
    super(`paid_pilot_unauthorized:${reason}`, reason);
    this.name = "PaidPilotUnauthorizedError";
  }
}

export class PaidPilotCostCeilingError extends SegmentedArchivistError {
  constructor(message: string) {
    super("paid_pilot_cost_ceiling", message);
    this.name = "PaidPilotCostCeilingError";
  }
}
