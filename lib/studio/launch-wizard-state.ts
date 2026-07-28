import { STUDIO_MILITARY_EXPERT_LAUNCH_ACK } from "./military-expert-local-policy.ts";

export type LaunchWizardAckState = {
  readonly privateUseAck: boolean;
  readonly experimentalAck: boolean;
  readonly militaryLaunchAckToken: string;
};

export type LaunchWizardMemberContext = {
  readonly isMilitaryLaunch: boolean;
  readonly needsExperimentalAck: boolean;
};

export function computeLaunchWizardPrivateUseConfirmed(
  member: LaunchWizardMemberContext,
  ack: Pick<LaunchWizardAckState, "privateUseAck" | "experimentalAck">,
): boolean {
  return ack.privateUseAck && (!member.needsExperimentalAck || ack.experimentalAck);
}

export function computeLaunchWizardCanLaunch(
  member: LaunchWizardMemberContext,
  ack: LaunchWizardAckState,
): boolean {
  const privateUseConfirmed = computeLaunchWizardPrivateUseConfirmed(member, ack);
  if (member.isMilitaryLaunch) {
    return (
      privateUseConfirmed && ack.militaryLaunchAckToken === STUDIO_MILITARY_EXPERT_LAUNCH_ACK
    );
  }
  return privateUseConfirmed;
}

export function launchWizardNeedsPrivateUseAck(member: LaunchWizardMemberContext): boolean {
  return member.isMilitaryLaunch || member.needsExperimentalAck;
}
