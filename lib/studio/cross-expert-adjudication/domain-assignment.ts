import type { CrossExpertNormalizedFinding, DomainAssignmentResult, SpecialistDomain } from "./types.ts";

interface DomainRule {
  readonly domain: SpecialistDomain;
  readonly sharedWithMilitaryExpert: boolean;
  readonly pattern: RegExp;
  readonly rationale: string;
}

const DOMAIN_RULES: readonly DomainRule[] = [
  {
    domain: "Developmental Editor",
    pattern: /foreshadow|dual.?agent|pamela|mira|character arc|pov count|motivation underdeveloped|swat team motivation/i,
    sharedWithMilitaryExpert: false,
    rationale: "Character foreshadowing and motivation are developmental craft concerns.",
  },
  {
    domain: "Combat Medicine Expert",
    pattern: /blood|transfusion|donation|citrate|medical realism|o.?negative|donor/i,
    sharedWithMilitaryExpert: false,
    rationale: "Field transfusion and donor physiology require combat-medicine expertise.",
  },
  {
    domain: "Financial Crimes Expert",
    pattern: /financial|money laundering|timeline compressed|ari/i,
    sharedWithMilitaryExpert: false,
    rationale: "Financial operation timing is outside core military operations judgment.",
  },
  {
    domain: "Thriller Editor",
    pattern: /castellano|escape route|escape logistics|plot vulnerability|identity reveal timing/i,
    sharedWithMilitaryExpert: false,
    rationale: "Antagonist reveal pacing and thriller mechanics are editorial concerns.",
  },
  {
    domain: "Intelligence Expert",
    pattern: /identity reveal|opsec|intelligence|surveillance|countersurveillance|infiltration/i,
    sharedWithMilitaryExpert: true,
    rationale: "Operational intelligence tradecraft overlaps military and intelligence domains.",
  },
  {
    domain: "Security/Construction Expert",
    pattern: /compound|breach|safe.?house|clearing|construction|perimeter/i,
    sharedWithMilitaryExpert: true,
    rationale: "Physical security and breach planning overlap tactical and security engineering.",
  },
  {
    domain: "Medical Expert",
    pattern: /casualty response|physiological|medical/i,
    sharedWithMilitaryExpert: false,
    rationale: "General medical realism beyond field transfusion belongs with a medical specialist.",
  },
];

export function assignSpecialistDomain(finding: CrossExpertNormalizedFinding): DomainAssignmentResult {
  const haystack = `${finding.title} ${finding.summary} ${finding.recommendation} ${finding.category}`;
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(haystack)) {
      return Object.freeze({
        findingKey: finding.findingKey,
        assignedDomain: rule.domain,
        sharedWithMilitaryExpert: rule.sharedWithMilitaryExpert,
        rationale: rule.rationale,
      });
    }
  }

  if (/communications|terminology|comms/i.test(haystack)) {
    return Object.freeze({
      findingKey: finding.findingKey,
      assignedDomain: "Military Expert",
      sharedWithMilitaryExpert: true,
      rationale: "Communications discipline during assault is core military expertise.",
    });
  }

  if (/fbi|coordination|rules|authority|deconfliction|tactical coordination/i.test(haystack)) {
    return Object.freeze({
      findingKey: finding.findingKey,
      assignedDomain: "Military Expert",
      sharedWithMilitaryExpert: true,
      rationale: "Interagency tactical coordination is central to military operational judgment.",
    });
  }

  if (/assault|tactics|operations|movement|cover|firefight|pursuit|kidnapping|containment/i.test(haystack)) {
    return Object.freeze({
      findingKey: finding.findingKey,
      assignedDomain: "Military Expert",
      sharedWithMilitaryExpert: true,
      rationale: "Operational tactics and assault planning are core military expertise.",
    });
  }

  return Object.freeze({
    findingKey: finding.findingKey,
    assignedDomain: "Military Expert",
    sharedWithMilitaryExpert: true,
    rationale: "Default retained under Military Expert pending specialist reroute signal.",
  });
}

export function isWrongDomainAssignment(
  finding: CrossExpertNormalizedFinding,
  assignment: DomainAssignmentResult,
): boolean {
  return finding.source === "military_expert" && assignment.assignedDomain !== "Military Expert" && !assignment.sharedWithMilitaryExpert;
}
