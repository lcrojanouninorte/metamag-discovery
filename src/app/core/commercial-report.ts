import { DiscoverySession } from './domain';
import {
  CommercialAlternative,
  CommercialProposal,
  CommercialService,
  CommercialServiceLine,
  Responsibility,
  ServiceDeliverable,
  ServiceMetric,
} from './commercial-model';
import { AlternativeCalculation, EstimateScenario } from './commercial-calculator';
import { getCommercialService } from './commercial-catalog';

export interface ClientProposalService {
  name: string;
  description: string;
  quantity: number;
  recurring: boolean;
  objective: string;
  scope: string;
  unitPriceCOP: number | null;
  subtotalCOP: number | null;
  deliverables: ServiceDeliverable[];
  exclusions: string[];
  hours: Record<EstimateScenario, number>;
  calendarDuration: { minDays: number | null; expectedDays: number | null; maxDays: number | null };
  responsibilities: Responsibility[];
  clientResponsibilities: string[];
  metamagResponsibilities: string[];
  metrics: ServiceMetric[];
}

export interface ClientProposalPriceBreakdown {
  servicesCOP: number | null;
  discountCOP: number | null;
  discountPercent: number;
  externalCostsCOP: number | null;
  taxesCOP: number | null;
  investmentCOP: number | null;
}

export interface ClientProposalDocument {
  clientName: string;
  organization: string;
  project: string;
  advisor: string;
  issueDate: string;
  validUntil: string;
  objective: string;
  knownState: string;
  alternativeName: string;
  alternativePositioning: string;
  paymentTerms: string;
  scheduleNote: string;
  externalCostNote: string;
  taxNote: string;
  dependencies: string[];
  services: ClientProposalService[];
  oneTime: ClientProposalPriceBreakdown;
  recurringMonthly: ClientProposalPriceBreakdown;
}

function serviceFor(line: CommercialServiceLine): CommercialService | undefined {
  return line.serviceSnapshot ?? getCommercialService(line.serviceId);
}

function hoursForLine(
  alternative: CommercialAlternative,
  line: CommercialServiceLine,
  scenario: EstimateScenario,
): number {
  const sharedKeys = new Set<string>();
  for (const previous of alternative.lines) {
    if (previous.id === line.id) break;
    for (const activity of previous.activitiesEstimate) {
      const key = activity.sharedActivityKey?.trim();
      if (key) sharedKeys.add(key);
    }
  }
  let total = 0;
  for (const activity of line.activitiesEstimate) {
    const key = activity.sharedActivityKey?.trim();
    if (key && sharedKeys.has(key)) continue;
    if (key) sharedKeys.add(key);
    const hours = scenario === 'optimistic'
      ? activity.hours.min
      : scenario === 'conservative' ? activity.hours.max : activity.hours.expected;
    total += (hours ?? 0) * line.quantity;
  }
  return total;
}

function breakdown(
  servicesCOP: number | null,
  discountCOP: number | null,
  externalCostsCOP: number | null,
  taxesCOP: number | null,
  investmentCOP: number | null,
  discountPercent: number,
): ClientProposalPriceBreakdown {
  return { servicesCOP, discountCOP, externalCostsCOP, taxesCOP, investmentCOP, discountPercent };
}

export function createClientProposalDocument(
  session: DiscoverySession,
  proposal: CommercialProposal,
  alternative: CommercialAlternative,
  calculation: AlternativeCalculation,
): ClientProposalDocument {
  const services = alternative.lines.map((line): ClientProposalService => {
    const service = serviceFor(line);
    return {
      name: service?.name ?? line.serviceId,
      description: service?.description ?? '',
      quantity: line.quantity,
      recurring: service?.recurring ?? false,
      objective: line.objective,
      scope: line.scopeNotes,
      unitPriceCOP: line.proposedUnitPriceCOP,
      subtotalCOP: line.proposedUnitPriceCOP === null ? null : line.proposedUnitPriceCOP * line.quantity,
      deliverables: structuredClone(line.deliverables),
      exclusions: [...line.exclusions],
      hours: {
        optimistic: hoursForLine(alternative, line, 'optimistic'),
        base: hoursForLine(alternative, line, 'base'),
        conservative: hoursForLine(alternative, line, 'conservative'),
      },
      calendarDuration: structuredClone(line.calendarDuration),
      responsibilities: structuredClone(service?.responsibilities ?? []),
      clientResponsibilities: [...(service?.clientResponsibilities ?? [])],
      metamagResponsibilities: [...(service?.metamagResponsibilities ?? [])],
      metrics: structuredClone(service?.metrics ?? []),
    };
  });

  return {
    clientName: session.clientName,
    organization: session.organization,
    project: session.project,
    advisor: session.advisor,
    issueDate: proposal.createdAt,
    validUntil: proposal.validUntil,
    objective: session.objective,
    knownState: session.knownState,
    alternativeName: alternative.name,
    alternativePositioning: alternative.positioning,
    paymentTerms: alternative.paymentTerms,
    scheduleNote: alternative.scheduleNote,
    externalCostNote: alternative.externalCostNote,
    taxNote: proposal.taxNote,
    dependencies: alternative.lines.map((line) => line.dependencyNote).filter(Boolean),
    services,
    oneTime: breakdown(
      calculation.oneTimeServiceSubtotalCOP,
      calculation.oneTimeDiscountCOP,
      calculation.oneTimeThirdPartyChargeCOP,
      calculation.oneTimeTaxCOP,
      calculation.oneTimeClientInvestmentCOP,
      alternative.discountPercent,
    ),
    recurringMonthly: breakdown(
      calculation.recurringServiceSubtotalCOP,
      calculation.recurringDiscountCOP,
      calculation.recurringThirdPartyChargeCOP,
      calculation.recurringTaxCOP,
      calculation.recurringMonthlyInvestmentCOP,
      alternative.discountPercent,
    ),
  };
}
