import { describe, expect, it } from 'vitest';
import { COMMERCIAL_SERVICES } from './commercial-catalog';
import { calculateAlternative, canApproveInternally, proposalStatusForAlternative } from './commercial-calculator';
import {
  CommercialAlternative,
  CommercialProposal,
  CommercialServiceLine,
  createCommercialProposal,
} from './commercial-model';
import { createClientProposalDocument } from './commercial-report';
import { DiscoverySession } from './domain';

function fixture() {
  const proposal = createCommercialProposal(new Date('2026-01-01T00:00:00.000Z'));
  proposal.settings = {
    ...proposal.settings,
    profiles: proposal.settings.profiles.map((profile) => ({
      ...profile,
      hourlyCostCOP: profile.id === 'strategist' ? 100 : null,
    })),
    indirectCostPercent: 20,
    contingencyPercent: 10,
    targetMarginPercent: 40,
    minimumAuthorizedMarginPercent: 75,
    taxPercent: 10,
  };
  const line: CommercialServiceLine = {
    id: 'line-1',
    serviceId: 'landing-page',
    serviceSnapshot: structuredClone(COMMERCIAL_SERVICES.find((service) => service.id === 'landing-page')!),
    quantity: 1,
    priceReviewed: true,
    objective: 'Publicar una página para captar solicitudes.',
    scopeNotes: 'Estructura, diseño, formulario, implementación y pruebas.',
    calendarDuration: { minDays: 15, expectedDays: 25, maxDays: 40 },
    deliverables: [{
      id: 'deliverable-1',
      name: 'Landing page',
      quantity: 1,
      format: 'URL responsive',
      acceptanceCriteria: 'Formulario y enlaces probados.',
    }],
    exclusions: [...COMMERCIAL_SERVICES.find((service) => service.id === 'landing-page')!.exclusions],
    activitiesEstimate: [{
      id: 'activity-1',
      name: 'Implementación básica',
      profileId: 'strategist',
      hours: { min: 1, expected: 2, max: 3 },
      assumptions: ['Una página'],
      uncertainty: 'medium',
    }],
    thirdPartyCostCOP: 10,
    otherDirectCostCOP: 5,
    thirdPartyChargeCOP: 100,
    proposedUnitPriceCOP: 1000,
    discountEligible: true,
    dependencyNote: 'Cliente confirma accesos y contenido.',
  };
  const alternative: CommercialAlternative = {
    ...proposal.alternatives[1],
    lines: [line],
    discountPercent: 15,
    paymentTerms: '50 % al inicio y 50 % a la entrega.',
    scheduleNote: '15 días calendario desde insumos aprobados.',
  };
  proposal.alternatives[1] = alternative;
  return { proposal, line, alternative };
}

describe('commercial catalog and calculator', () => {
  it('provides eight complete, versioned services without default prices', () => {
    expect(COMMERCIAL_SERVICES).toHaveLength(8);
    expect(new Set(COMMERCIAL_SERVICES.map((service) => service.id)).size).toBe(8);
    expect(COMMERCIAL_SERVICES.every((service) =>
      service.activitiesEstimate.length > 0 &&
      service.deliverables.length > 0 &&
      service.responsibilities.length > 0 &&
      service.metrics.some((metric) => metric.kind === 'execution') &&
      service.metrics.some((metric) => metric.kind === 'quality') &&
      service.metrics.some((metric) => metric.kind === 'commercial') &&
      !Object.hasOwn(service, 'referencePriceCOP'),
    )).toBe(true);
    expect(COMMERCIAL_SERVICES.find((service) => service.id === 'ad-campaign-management'))
      .toMatchObject({ recurring: true, discountEligible: false });
    expect(COMMERCIAL_SERVICES.find((service) => service.id === 'short-video-editing')?.responsibilities
      .some((item) => item.activity === 'Grabación presencial' && item.state === 'excluded')).toBe(true);
    expect(COMMERCIAL_SERVICES.find((service) => service.id === 'landing-page')?.exclusions.join(' '))
      .toContain('Dominio, hosting');
    expect(COMMERCIAL_SERVICES.find((service) => service.id === 'masterclass-support')?.exclusions.join(' '))
      .toContain('contenido intelectual del libro');
  });

  it('calculates bottom-up hours, labor, indirects, contingency, target margin and tax separately', () => {
    const { proposal, alternative } = fixture();
    const result = calculateAlternative(proposal, alternative);

    expect(result.hours).toMatchObject({
      optimistic: { total: 1, byProfile: { strategist: 1 } },
      base: { total: 2, byProfile: { strategist: 2 } },
      conservative: { total: 3, byProfile: { strategist: 3 } },
    });
    expect(result.laborCostCOP).toEqual({ optimistic: 100, base: 200, conservative: 300 });
    expect(result.totalCostCOP).toEqual({ optimistic: 149, base: 281, conservative: 413 });
    expect(result.targetPriceCOP).toEqual({ optimistic: 248, base: 468, conservative: 688 });
    expect(result.discountCOP).toBe(150);
    expect(result.thirdPartyChargeCOP).toBe(100);
    expect(result.taxCOP).toBe(95);
    expect(result.clientInvestmentCOP).toBe(1045);
    expect(result.estimatedMarginPercent).toBeCloseTo(70.42, 1);
    expect(result.belowMinimumMargin).toBe(true);
    expect(result.blockers.some((blocker) => blocker.includes('mínimo autorizado'))).toBe(true);
  });

  it('leaves profitability indeterminate when internal rates, costs or tax settings are unknown', () => {
    const { proposal, alternative, line } = fixture();
    proposal.settings.profiles = proposal.settings.profiles.map((profile) => ({ ...profile, hourlyCostCOP: null }));
    line.thirdPartyCostCOP = null;
    line.otherDirectCostCOP = null;
    line.thirdPartyChargeCOP = null;
    proposal.settings.taxPercent = null;

    const result = calculateAlternative(proposal, alternative);
    expect(result.laborCostCOP.base).toBeNull();
    expect(result.totalCostCOP.base).toBeNull();
    expect(result.estimatedMarginPercent).toBeNull();
    expect(result.clientInvestmentCOP).toBeNull();
    expect(result.blockers.join(' ')).toContain('costo horario interno');
    expect(result.blockers.join(' ')).toContain('costos directos');
    expect(result.blockers.join(' ')).toContain('tasa de impuestos');
  });

  it('keeps investment indeterminate until an advisor enters a service price', () => {
    const { proposal, alternative, line } = fixture();
    line.proposedUnitPriceCOP = null;
    const result = calculateAlternative(proposal, alternative);

    expect(result.blockers.join(' ')).toContain('requiere un precio comercial propuesto');
    expect(result.oneTimeServiceSubtotalCOP).toBeNull();
    expect(result.discountCOP).toBeNull();
    expect(result.clientInvestmentCOP).toBeNull();
  });

  it('discounts only eligible service revenue and never the external charge', () => {
    const { proposal, alternative, line } = fixture();
    line.discountEligible = false;
    proposal.settings.taxPercent = 0;
    const result = calculateAlternative(proposal, alternative);

    expect(result.discountCOP).toBe(0);
    expect(result.clientInvestmentCOP).toBe(1100);
  });

  it('keeps recurring campaign fees separate from one-time investment and ineligible discounts', () => {
    const { proposal, alternative, line } = fixture();
    line.serviceId = 'ad-campaign-management';
    line.serviceSnapshot = structuredClone(COMMERCIAL_SERVICES.find((service) => service.id === line.serviceId)!);
    line.discountEligible = false;
    line.proposedUnitPriceCOP = 950000;
    line.thirdPartyCostCOP = 0;
    line.otherDirectCostCOP = 0;
    line.thirdPartyChargeCOP = 250000;
    proposal.settings.taxPercent = 0;
    const result = calculateAlternative(proposal, alternative);

    expect(result.oneTimeServiceSubtotalCOP).toBe(0);
    expect(result.recurringServiceSubtotalCOP).toBe(950000);
    expect(result.recurringDiscountCOP).toBe(0);
    expect(result.oneTimeClientInvestmentCOP).toBe(0);
    expect(result.recurringMonthlyInvestmentCOP).toBe(1200000);
  });

  it('does not double-count shared activities without a matching, justified synergy', () => {
    const { proposal, alternative, line } = fixture();
    const second = {
      ...line,
      id: 'line-2',
      serviceId: 'crm-setup' as const,
      activitiesEstimate: structuredClone(line.activitiesEstimate),
    };
    line.activitiesEstimate[0].sharedActivityKey = 'reunion-inicial';
    line.activitiesEstimate[0].sharedActivityJustification = 'Una sola sesión cubre requisitos de ambos servicios.';
    second.activitiesEstimate[0].sharedActivityKey = 'reunion-inicial';
    second.activitiesEstimate[0].sharedActivityJustification = 'Una sola sesión cubre requisitos de ambos servicios.';
    alternative.lines = [line, second];
    const result = calculateAlternative(proposal, alternative);

    expect(result.hours.base.total).toBe(2);
    expect(result.laborCostCOP.base).toBe(200);
    expect(result.blockers.some((blocker) => blocker.includes('sinergia'))).toBe(false);

    second.activitiesEstimate[0].hours.expected = 4;
    const inconsistent = calculateAlternative(proposal, alternative);
    expect(inconsistent.blockers.join(' ')).toContain('mismo perfil, cantidad y rango de horas');
  });

  it('requires explicit service selection, scope, deliverables, dependencies and payment conditions before approval', () => {
    const { proposal, alternative, line } = fixture();
    expect(proposal.alternatives.filter((option) => option.id !== 'recommended')
      .every((option) => option.lines.length === 0)).toBe(true);
    expect(proposalStatusForAlternative(proposal, { ...alternative, lines: [] })).toBe('estimation_incomplete');
    line.scopeNotes = '';
    line.dependencyNote = '';
    line.deliverables[0].acceptanceCriteria = '';
    alternative.paymentTerms = '';
    const result = calculateAlternative(proposal, alternative);
    expect(result.blockers.join(' ')).toContain('objetivo y alcance');
    expect(result.blockers.join(' ')).toContain('entregables y criterios');
    expect(result.blockers.join(' ')).toContain('dependencias');
    expect(result.blockers.join(' ')).toContain('condiciones de pago');
  });

  it('treats a cleared hour estimate as missing rather than zero work', () => {
    const { proposal, alternative, line } = fixture();
    line.activitiesEstimate[0].hours.expected = null;
    const result = calculateAlternative(proposal, alternative);
    expect(result.blockers.join(' ')).toContain('horas incompletas o inconsistentes');
    expect(proposalStatusForAlternative(proposal, alternative)).toBe('estimation_incomplete');
  });

  it('requires price confirmation and coherent editable calendar days', () => {
    const { proposal, alternative, line } = fixture();
    line.priceReviewed = false;
    line.calendarDuration = { minDays: 20, expectedDays: 10, maxDays: 30 };
    const result = calculateAlternative(proposal, alternative);
    expect(result.blockers.join(' ')).toContain('confirmar que el precio comercial propuesto');
    expect(result.blockers.join(' ')).toContain('duración calendario mínima, esperada y máxima coherente');
  });

  it('keeps discounted revenue below the configured margin visible for explicit approval', () => {
    const { proposal, alternative } = fixture();
    proposal.discountApproval = { approved: true, justification: '' };
    const result = calculateAlternative(proposal, alternative);
    expect(result.belowMinimumMargin).toBe(true);
    expect(result.blockers.join(' ')).toContain('justificación');
  });

  it('never marks an estimation complete as internally approved without a deliberate advisor action', () => {
    const { proposal, alternative } = fixture();
    proposal.discountApproval = { approved: true, justification: 'Excepción aprobada por alcance y prioridad acordados.' };
    proposal.internalApproval.note = 'Revisé el precio, los costos y la incertidumbre de horas.';
    expect(calculateAlternative(proposal, alternative).blockers).toHaveLength(0);
    expect(canApproveInternally(proposal, alternative)).toBe(true);
    expect(proposalStatusForAlternative(proposal, alternative)).toBe('pending_review');
  });

  it('projects consistent client-PDF data without internal rates, costs, or margins', () => {
    const { proposal, alternative, line } = fixture();
    const session: DiscoverySession = {
      id: 'session',
      formId: 'form',
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      clientName: 'Cliente de prueba',
      organization: 'Organización de prueba',
      project: 'Proyecto de prueba',
      advisor: 'Asesor de prueba',
      meetingDate: '2026-01-01',
      objective: 'Acordar una landing page medible.',
      productType: 'Digital',
      knownState: 'Contexto reportado, pendiente de validar.',
      initialNotes: '',
      activeSectionId: '',
      activeQuestionId: '',
      responses: {},
      assessments: {},
      manualLevelId: null,
      manualLevelJustification: '',
      recommendations: {},
      actions: [],
      initiativeComplexity: '',
      internalCapacity: '',
      delegatedResponsibilities: '',
      budgetAndTimeline: '',
    };
    const calculation = calculateAlternative(proposal, alternative);
    const document = createClientProposalDocument(session, proposal, alternative, calculation);
    const serialized = JSON.stringify(document);

    expect(document.oneTime.investmentCOP).toBe(calculation.oneTimeClientInvestmentCOP);
    expect(document.services[0].hours.base).toBe(2);
    expect(document.services[0].unitPriceCOP).toBe(line.proposedUnitPriceCOP);
    expect(serialized).not.toMatch(/hourlyCostCOP|laborCostCOP|targetPriceCOP|estimatedMarginPercent|internalApproval|thirdPartyCostCOP|otherDirectCostCOP|advisorNote|referencePriceCOP/);
  });
});
