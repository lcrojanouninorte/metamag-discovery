import { DiscoverySession } from './domain';
import {
  CommercialAlternative,
  CommercialProposal,
  CommercialService,
  CommercialServiceLine,
  Responsibility,
  ServiceDeliverable,
} from './commercial-model';
import { AlternativeCalculation } from './commercial-calculator';
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
  calendarDuration: { minDays: number | null; expectedDays: number | null; maxDays: number | null };
  responsibilities: Responsibility[];
  clientResponsibilities: string[];
  metamagResponsibilities: string[];
}

export interface ClientProposalPriceBreakdown {
  servicesCOP: number | null;
  discountCOP: number | null;
  discountPercent: number;
  externalCostsCOP: number | null;
  taxesCOP: number | null;
  withholdingCOP: number | null;
  investmentCOP: number | null;
}

export interface ClientProposalDocument {
  isDraft: boolean;
  taxesPending: boolean;
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

function breakdown(
  servicesCOP: number | null,
  discountCOP: number | null,
  externalCostsCOP: number | null,
  taxesCOP: number | null,
  withholdingCOP: number | null,
  investmentCOP: number | null,
  discountPercent: number,
): ClientProposalPriceBreakdown {
  return { servicesCOP, discountCOP, externalCostsCOP, taxesCOP, withholdingCOP, investmentCOP, discountPercent };
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
      calendarDuration: structuredClone(line.calendarDuration),
      responsibilities: structuredClone(service?.responsibilities ?? []),
      clientResponsibilities: [...(service?.clientResponsibilities ?? [])],
      metamagResponsibilities: [...(service?.metamagResponsibilities ?? [])],
    };
  });

  return {
    isDraft: !['internally_approved', 'shared_with_client', 'accepted', 'rejected'].includes(proposal.status),
    taxesPending: proposal.settings.taxValidationStatus !== 'validated'
      || alternative.lines.some((line) => (proposal.settings.taxTreatments[line.serviceId] ?? line.taxTreatment) === 'pending')
      || (alternative.lines.some((line) => proposal.settings.taxTreatments[line.serviceId] === 'taxable')
        && proposal.settings.taxPercent === null),
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
    taxNote: proposal.settings.taxValidationStatus !== 'validated'
      ? 'Los valores se expresan antes de impuestos. Los impuestos aplicables y las retenciones se determinarán conforme a la cotización aprobada.'
      : proposal.taxNote || 'Los impuestos y las retenciones aplicables se detallan en esta cotización.',
    dependencies: alternative.lines.map((line) => line.dependencyNote).filter(Boolean),
    services,
    oneTime: breakdown(
      calculation.oneTimeServiceSubtotalCOP,
      calculation.oneTimeDiscountCOP,
      calculation.oneTimeThirdPartyChargeCOP,
      calculation.oneTimeTaxCOP,
      calculation.oneTimeWithholdingCOP,
      calculation.oneTimeClientInvestmentCOP,
      alternative.discountPercent,
    ),
    recurringMonthly: breakdown(
      calculation.recurringServiceSubtotalCOP,
      calculation.recurringDiscountCOP,
      calculation.recurringThirdPartyChargeCOP,
      calculation.recurringTaxCOP,
      calculation.recurringWithholdingCOP,
      calculation.recurringMonthlyInvestmentCOP,
      alternative.discountPercent,
    ),
  };
}
