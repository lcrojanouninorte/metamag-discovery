import { describe, expect, it } from 'vitest';
import { exportCommercialConfiguration, parseCommercialConfiguration } from './commercial-config';
import { createCommercialProposal } from './commercial-model';

describe('commercial financial configuration', () => {
  it('starts with editable planning references for the eight services and the specified financial assumptions', () => {
    const proposal = createCommercialProposal(new Date('2026-01-01T00:00:00.000Z'));

    expect(Object.values(proposal.servicePricing).map((item) => item.referencePriceCOP))
      .toEqual([500_000, 750_000, 800_000, 700_000, 1_800_000, 850_000, 1_100_000, 950_000]);
    expect(Object.values(proposal.servicePricing).map((item) => item.status)).toEqual(Array(8).fill('estimated'));
    expect(proposal.servicePricing['masterclass-support'].includedScope).toContain('Acompañamiento básico');
    expect(proposal.servicePricing['ad-campaign-management'].hoursByProfile.media_specialist).toBe(12);
    expect(proposal.settings.profiles.find((item) => item.id === 'strategist')?.hourlyCostCOP).toBe(45_000);
    expect(proposal.settings.profiles.find((item) => item.id === 'consultant')?.hourlyCostCOP).toBe(35_000);
    expect(proposal.settings).toMatchObject({
      indirectCostPercent: 0,
      indirectCostConfigured: false,
      contingencyPercent: 10,
      targetMarginPercent: 40,
      minimumAuthorizedMarginPercent: 25,
      defaultDiscountPercent: 0,
      maximumDiscountPercent: 15,
      quoteValidityDays: 15,
      taxValidationStatus: 'pending',
      taxPercent: null,
    });
    expect(proposal.alternatives.every((item) => item.discountPercent === 0)).toBe(true);
    expect(proposal.alternatives[1].paymentTerms).toContain('50 %');
  });

  it('exports and imports editable settings and service prices as JSON', () => {
    const proposal = createCommercialProposal(new Date('2026-01-01T00:00:00.000Z'));
    proposal.servicePricing['landing-page'].referencePriceCOP = 2_000_000;
    proposal.settings.profiles[0].hourlyCostCOP = 50_000;
    proposal.settings.taxValidationStatus = 'validated';
    proposal.settings.taxTreatments['landing-page'] = 'taxable';
    const serialized = exportCommercialConfiguration(proposal, new Date('2026-01-02T00:00:00.000Z'));
    const imported = parseCommercialConfiguration(JSON.parse(serialized));

    expect(imported.servicePricing['landing-page'].referencePriceCOP).toBe(2_000_000);
    expect(imported.settings.profiles.find((item) => item.id === 'strategist')?.hourlyCostCOP).toBe(50_000);
    expect(imported.settings.taxValidationStatus).toBe('validated');
    expect(imported.settings.taxTreatments['landing-page']).toBe('taxable');
  });

  it('rejects invalid service prices and missing tax classifications', () => {
    const payload = JSON.parse(exportCommercialConfiguration(createCommercialProposal())) as {
      servicePricing: Record<string, { referencePriceCOP: number }>;
      settings: { taxTreatments: Record<string, string> };
    };
    payload.servicePricing['landing-page'].referencePriceCOP = -1;
    expect(() => parseCommercialConfiguration(payload)).toThrow('precio, alcance o unidad');

    const valid = JSON.parse(exportCommercialConfiguration(createCommercialProposal())) as typeof payload;
    valid.settings.taxTreatments['landing-page'] = 'unknown';
    expect(() => parseCommercialConfiguration(valid)).toThrow('tratamiento tributario');
  });
});
