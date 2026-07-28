import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STUDIO_MILITARY_EXPERT_LAUNCH_ACK } from "./military-expert-local-policy.ts";
import {
  computeLaunchWizardCanLaunch,
  computeLaunchWizardPrivateUseConfirmed,
  launchWizardNeedsPrivateUseAck,
} from "./launch-wizard-state.ts";

const MILITARY = {
  isMilitaryLaunch: true,
  needsExperimentalAck: true,
} as const;

const LITERARY = {
  isMilitaryLaunch: false,
  needsExperimentalAck: false,
} as const;

describe("Launch wizard acknowledgement state", () => {
  it("requires in-wizard private-use ack for military launches", () => {
    assert.equal(launchWizardNeedsPrivateUseAck(MILITARY), true);
    assert.equal(
      computeLaunchWizardCanLaunch(MILITARY, {
        privateUseAck: false,
        experimentalAck: true,
        militaryLaunchAckToken: STUDIO_MILITARY_EXPERT_LAUNCH_ACK,
      }),
      false,
    );
  });

  it("enables military launch when all wizard acknowledgements are satisfied", () => {
    assert.equal(
      computeLaunchWizardCanLaunch(MILITARY, {
        privateUseAck: true,
        experimentalAck: true,
        militaryLaunchAckToken: STUDIO_MILITARY_EXPERT_LAUNCH_ACK,
      }),
      true,
    );
  });

  it("rejects military launch when token does not match exactly", () => {
    assert.equal(
      computeLaunchWizardCanLaunch(MILITARY, {
        privateUseAck: true,
        experimentalAck: true,
        militaryLaunchAckToken: "partial-token",
      }),
      false,
    );
  });

  it("requires experimental ack only when member policy is experimental", () => {
    assert.equal(
      computeLaunchWizardPrivateUseConfirmed(MILITARY, {
        privateUseAck: true,
        experimentalAck: false,
      }),
      false,
    );
    assert.equal(
      computeLaunchWizardPrivateUseConfirmed(LITERARY, {
        privateUseAck: true,
        experimentalAck: false,
      }),
      true,
    );
  });

  it("does not require private-use ack in wizard for certified non-experimental experts", () => {
    assert.equal(launchWizardNeedsPrivateUseAck(LITERARY), false);
    assert.equal(
      computeLaunchWizardCanLaunch(LITERARY, {
        privateUseAck: false,
        experimentalAck: false,
        militaryLaunchAckToken: "",
      }),
      false,
    );
    assert.equal(
      computeLaunchWizardCanLaunch(LITERARY, {
        privateUseAck: true,
        experimentalAck: false,
        militaryLaunchAckToken: "",
      }),
      true,
    );
  });
});
