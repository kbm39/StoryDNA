import { searchManuscriptMarker } from "./text-normalize.ts";
import type { CrossExpertNormalizedFinding, TacticalCoverageDomain } from "./types.ts";

const TACTICAL_DOMAINS: readonly {
  readonly domainId: string;
  readonly label: string;
  readonly scenePattern: RegExp;
  readonly findingPattern: RegExp;
}[] = [
  { domainId: "office_sniper", label: "Office sniper attack", scenePattern: /sniper|office attack|sniper fire/i, findingPattern: /sniper|office/i },
  { domainId: "vehicle_kidnapping", label: "Vehicle containment and kidnapping", scenePattern: /kidnap|abduct|vehicle|containment|van/i, findingPattern: /kidnap|vehicle|containment/i },
  { domainId: "home_clearing", label: "Home clearing", scenePattern: /clear(ing)? the (house|home|room)|room.?by.?room|stack and clear/i, findingPattern: /clear(ing)?|home/i },
  { domainId: "countersurveillance", label: "Countersurveillance", scenePattern: /counter.?surveillance|tail|follow|watching/i, findingPattern: /surveillance|tail/i },
  { domainId: "family_extraction", label: "Family extractions", scenePattern: /extract|evacuate|family|children|wife/i, findingPattern: /extract|family/i },
  { domainId: "safe_house", label: "Safe-house defense", scenePattern: /safe.?house|fallback|secure location/i, findingPattern: /safe.?house|defense/i },
  { domainId: "prison_access", label: "Prison access operation", scenePattern: /prison|jail|detention|cell block/i, findingPattern: /prison|jail/i },
  { domainId: "compound_infiltration", label: "Compound infiltration", scenePattern: /compound|infiltrat|perimeter breach|wire/i, findingPattern: /compound|infiltrat/i },
  { domainId: "fbi_deconfliction", label: "Breach and FBI deconfliction", scenePattern: /fbi|deconflict|coordination|briefing|tactical team/i, findingPattern: /fbi|coordination|deconflict/i },
  { domainId: "movement_cover", label: "Movement and cover", scenePattern: /cover fire|movement to cover|bounding|advance/i, findingPattern: /movement|cover/i },
  { domainId: "civilian_protection", label: "Civilian protection", scenePattern: /civilian|hostage|innocent|bystander/i, findingPattern: /civilian|hostage/i },
  { domainId: "nonlethal_leg_shot", label: "Nonlethal leg-shot tactics", scenePattern: /leg shot|nonlethal|incapacitat|wound(ed)? in the leg/i, findingPattern: /leg shot|nonlethal/i },
  { domainId: "command_comms", label: "Command and communications", scenePattern: /radio|comms|command post|call sign|breach breacher/i, findingPattern: /comms|communications|command/i },
  { domainId: "multi_firefight", label: "Multi-sided firefight", scenePattern: /crossfire|firefight|multiple shooters|three.?way/i, findingPattern: /firefight|crossfire/i },
  { domainId: "pursuit_decision", label: "Pursuit decision", scenePattern: /pursuit|chase|follow(ed)? them|abort pursuit/i, findingPattern: /pursuit|chase/i },
  { domainId: "casualty_response", label: "Casualty response", scenePattern: /casualty|transfusion|blood|medevac|tourniquet|wounded/i, findingPattern: /casualty|transfusion|blood|medical/i },
];

export function evaluateTacticalCoverage(args: {
  readonly manuscriptText: string;
  readonly militaryExpertFindings: readonly CrossExpertNormalizedFinding[];
}): readonly TacticalCoverageDomain[] {
  return TACTICAL_DOMAINS.map((domain) => {
    const scene = searchManuscriptMarker(args.manuscriptText, domain.scenePattern);
    const relatedFindingKeys = args.militaryExpertFindings
      .filter((finding) => domain.findingPattern.test(`${finding.title} ${finding.summary} ${finding.category}`))
      .map((finding) => finding.findingKey);
    return Object.freeze({
      domainId: domain.domainId,
      label: domain.label,
      covered: scene.found || relatedFindingKeys.length > 0,
      relatedFindingKeys: Object.freeze(relatedFindingKeys),
      sceneSignals: Object.freeze(scene.found ? [`scene:${domain.domainId}`] : []),
    });
  });
}

export function summarizeTacticalCoverage(domains: readonly TacticalCoverageDomain[]): {
  readonly coveredCount: number;
  readonly missedCount: number;
  readonly missedDomains: readonly string[];
  readonly coverageRatio: number;
} {
  const coveredCount = domains.filter((d) => d.covered).length;
  const missedDomains = domains.filter((d) => !d.covered).map((d) => d.label);
  return Object.freeze({
    coveredCount,
    missedCount: missedDomains.length,
    missedDomains: Object.freeze(missedDomains),
    coverageRatio: domains.length === 0 ? 0 : coveredCount / domains.length,
  });
}
