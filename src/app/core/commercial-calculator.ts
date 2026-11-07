import {
  CommercialAlternative,
  CommercialProposal,
  CommercialRoleId,
  CommercialServiceLine,
  HourRange,
  ProposalOptionId,
  ProposalStatus,
} from './commercial-model';
import { getCommercialService } from './commercial-catalog';

export type EstimateScenario = 'optimistic' | 'base' | 'conservative';

export interface HourSummary {
  total: number;
  byProfile: Partial<Record<CommercialRoleId, number>>;
}

export interface AlternativeCalculation {
  optionId: ProposalOptionId;
  hours: Record<EstimateScenario, HourSummary>;
  laborCostCOP: Record<EstimateScenario, number | null>;
  totalCostCOP: Record<EstimateScenario, number | null>;
  targetPriceCOP: Record<EstimateScenario, number | null>;
  minimumPriceAtMinimumMarginCOP: Record<EstimateScenario, number | null>;
  serviceSubtotalCOP: number | null;
  oneTimeServiceSubtotalCOP: number | null;
  recurringServiceSubtotalCOP: number | null;
  discountCOP: number | null;
  oneTimeDiscountCOP: number | null;
  recurringDiscountCOP: number | null;
  thirdPartyChargeCOP: number | null;
  oneTimeThirdPartyChargeCOP: number | null;
  recurringThirdPartyChargeCOP: number | null;
  taxCOP: number | null;
  oneTimeTaxCOP: number | null;
  recurringTaxCOP: number | null;
  oneTimeWithholdingCOP: number | null;
  recurringWithholdingCOP: number | null;
  clientInvestmentCOP: number | null;
  pretaxClientInvestmentCOP: number | null;
  withholdingCOP: number | null;
  oneTimeClientInvestmentCOP: number | null;
  recurringMonthlyInvestmentCOP: number | null;
  estimatedMarginPercent: number | null;
  profitabilityState: 'favorable' | 'adjusted' | 'insufficient' | 'provisional' | 'undetermined';
  serviceEconomics: {
    serviceId: CommercialServiceLine['serviceId'];
    referencePriceCOP: number;
    unit: string;
    estimatedCostCOP: number | null;
    targetPriceCOP: number | null;
    minimumPriceCOP: number | null;
    estimatedMarginPercent: number | null;
    belowMinimumViable: boolean;
  }[];
  revenuePerExpectedHourCOP: number | null;
  conservativeHoursOverBasePercent: number | null;
  conservativeCostOverBaseCOP: number | null;
  warnings: string[];
  blockers: string[];
  belowMinimumMargin: boolean;
}

const scenarioHour = (hours: HourRange, scenario: EstimateScenario): number =>
  (scenario === 'optimistic' ? hours.min : scenario === 'conservative' ? hours.max : hours.expected) ?? 0;

const money = (value: number): number => Math.round(value);

function sumHours(alternative: CommercialAlternative, scenario: EstimateScenario): HourSummary {
  const byProfile: Partial<Record<CommercialRoleId, number>> = {};
  const countedSharedActivities = new Set<string>();
  for (const line of alternative.lines) {
    for (const activity of line.activitiesEstimate) {
      const sharedKey = activity.sharedActivityKey?.trim();
      if (sharedKey && countedSharedActivities.has(sharedKey)) continue;
      if (sharedKey) countedSharedActivities.add(sharedKey);
      byProfile[activity.profileId] = (byProfile[activity.profileId] ?? 0)
        + scenarioHour(activity.hours, scenario) * line.quantity;
    }
  }
  return {
    total: Object.values(byProfile).reduce((sum, hours) => sum + (hours ?? 0), 0),
    byProfile,
  };
}

function laborCost(
  hours: HourSummary,
  proposal: CommercialProposal,
): number | null {
  let total = 0;
  for (const [profileId, profileHours] of Object.entries(hours.byProfile) as [CommercialRoleId, number][]) {
    const profile = proposal.settings.profiles.find((item) => item.id === profileId);
    if (!profile || profile.hourlyCostCOP === null || !Number.isFinite(profile.hourlyCostCOP) || profile.hourlyCostCOP < 0) {
      return null;
    }
    total += profileHours * profile.hourlyCostCOP;
  }
  return money(total);
}

function directCosts(alternative: CommercialAlternative): { cost: number | null; charge: number | null } {
  let cost = 0;
  let charge = 0;
  for (const line of alternative.lines) {
    const thirdPartyCost = line.thirdPartyCostCOP;
    const otherDirectCost = line.otherDirectCostCOP;
    const thirdPartyCharge = line.thirdPartyChargeCOP;
    if (typeof thirdPartyCost !== 'number' || !Number.isFinite(thirdPartyCost) || thirdPartyCost < 0
      || typeof otherDirectCost !== 'number' || !Number.isFinite(otherDirectCost) || otherDirectCost < 0
      || typeof thirdPartyCharge !== 'number' || !Number.isFinite(thirdPartyCharge) || thirdPartyCharge < 0) {
      return { cost: null, charge: null };
    }
    const quantity = line.quantity;
    cost += (thirdPartyCost + otherDirectCost) * quantity;
    charge += thirdPartyCharge * quantity;
  }
  return { cost: money(cost), charge: money(charge) };
}

function validPercent(value: number | null, allowOneHundred = false): boolean {
  return value !== null && Number.isFinite(value) && value >= 0 && (allowOneHundred ? value <= 100 : value < 100);
}

function lineBlockers(line: CommercialServiceLine): string[] {
  const service = line.serviceSnapshot ?? getCommercialService(line.serviceId);
  const result: string[] = [];
  if (!service) result.push('Hay un servicio del catálogo que ya no está disponible.');
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) result.push('La cantidad debe ser mayor que cero.');
  if (!Number.isInteger(line.quantity)) result.push('La cantidad de servicios debe ser un número entero.');
  if (line.proposedUnitPriceCOP === null || !Number.isFinite(line.proposedUnitPriceCOP) || line.proposedUnitPriceCOP < 0) {
    result.push(`${service?.name ?? 'Un servicio'} requiere un precio comercial propuesto.`);
  }
  if (!line.priceReviewed) result.push(`${service?.name ?? 'Un servicio'} requiere confirmar que el precio comercial propuesto refleja el alcance y las condiciones acordadas.`);
  if ([line.thirdPartyCostCOP, line.otherDirectCostCOP, line.thirdPartyChargeCOP]
    .some((value) => value !== null && value < 0)) result.push('Los costos y cargos externos no pueden ser negativos.');
  const { minDays, expectedDays, maxDays } = line.calendarDuration;
  if ([minDays, expectedDays, maxDays].some((value) => value === null || !Number.isFinite(value))
    || (minDays ?? 0) < 0 || (minDays ?? 0) > (expectedDays ?? 0) || (expectedDays ?? 0) > (maxDays ?? 0)) {
    result.push(`${service?.name ?? 'Un servicio'} requiere una duración calendario mínima, esperada y máxima coherente.`);
  }
  if (!line.objective.trim() || !line.scopeNotes.trim()) result.push(`${service?.name ?? 'Un servicio'} requiere objetivo y alcance explícitos.`);
  if (line.deliverables.length === 0 || line.deliverables.some((item) => !item.name.trim() || !item.acceptanceCriteria.trim())) {
    result.push(`${service?.name ?? 'Un servicio'} requiere entregables y criterios de aceptación.`);
  }
  if (service?.exclusions.some((item) => !line.exclusions.includes(item))) {
    result.push(`${service.name} no puede eliminar exclusiones base del catálogo; documenta el cambio de alcance como un acuerdo adicional.`);
  }
  if (line.activitiesEstimate.length === 0) result.push(`${service?.name ?? 'Un servicio'} no tiene actividades estimadas.`);
  for (const activity of line.activitiesEstimate) {
    const { min, expected, max } = activity.hours;
    if (!activity.name.trim() || [min, expected, max].some((value) => value === null || !Number.isFinite(value))
      || (min ?? 0) < 0 || (min ?? 0) > (expected ?? 0) || (expected ?? 0) > (max ?? 0)) {
      result.push(`${service?.name ?? 'Un servicio'} tiene una actividad con horas incompletas o inconsistentes.`);
      break;
    }
    if (activity.sharedActivityKey?.trim() && (activity.sharedActivityJustification ?? '').trim().length < 12) {
      result.push(`${activity.name} requiere justificar la actividad compartida antes de descontar horas duplicadas.`);
    }
    }
    if (line.activitiesEstimate.length && line.activitiesEstimate.every(
      (activity) => activity.hours.min === 0 && activity.hours.expected === 0 && activity.hours.max === 0,
    )) result.push(`${service?.name ?? 'Un servicio'} necesita una estimación de esfuerzo distinta de cero.`);
  if (!line.dependencyNote.trim()) result.push(`${service?.name ?? 'Un servicio'} requiere confirmar sus dependencias antes de aprobar.`);
  return result;
}

function sharedActivityBlockers(alternative: CommercialAlternative): string[] {
  const groups = new Map<string, { activity: CommercialServiceLine['activitiesEstimate'][number]; quantity: number }[]>();
  for (const line of alternative.lines) {
    for (const activity of line.activitiesEstimate) {
      const key = activity.sharedActivityKey?.trim();
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push({ activity, quantity: line.quantity });
      groups.set(key, group);
    }
  }
  const blockers: string[] = [];
  for (const [key, entries] of groups) {
    if (entries.length < 2) continue;
    const first = entries[0];
    const consistent = entries.every(({ activity, quantity }) =>
      quantity === first.quantity &&
      activity.profileId === first.activity.profileId &&
      activity.hours.min === first.activity.hours.min &&
      activity.hours.expected === first.activity.hours.expected &&
      activity.hours.max === first.activity.hours.max,
    );
    if (!consistent) blockers.push(`La sinergia "${key}" debe tener el mismo perfil, cantidad y rango de horas en todos los servicios para evitar una subestimación.`);
    if (entries.some(({ activity }) => (activity.sharedActivityJustification ?? '').trim().length < 12)) {
      blockers.push(`La sinergia "${key}" requiere una justificación verificable de al menos 12 caracteres.`);
    }
  }
  return blockers;
}

export function calculateAlternative(
  proposal: CommercialProposal,
  alternative: CommercialAlternative,
): AlternativeCalculation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!alternative.lines.length) blockers.push('Agrega al menos un servicio seleccionado explícitamente.');
  if (!Number.isFinite(alternative.discountPercent) || alternative.discountPercent < 0 || alternative.discountPercent > 100) {
    blockers.push('El descuento debe estar entre 0 % y 100 %.');
  }
  for (const line of alternative.lines) blockers.push(...lineBlockers(line));
  blockers.push(...sharedActivityBlockers(alternative));

  let oneTimeServiceSubtotalValue = 0;
  let recurringServiceSubtotalValue = 0;
  let oneTimeEligibleSubtotal = 0;
  let recurringEligibleSubtotal = 0;
  let oneTimeCharge = 0;
  let recurringCharge = 0;
  let oneTimeUnpriced = false;
  let recurringUnpriced = false;
  for (const line of alternative.lines) {
    const recurring = line.serviceSnapshot?.recurring ?? getCommercialService(line.serviceId)?.recurring ?? false;
    const proposedPrice = line.proposedUnitPriceCOP;
    const hasValidPrice = proposedPrice !== null && Number.isFinite(proposedPrice) && proposedPrice >= 0;
    const serviceAmount = proposedPrice !== null && Number.isFinite(proposedPrice) && proposedPrice >= 0
      ? proposedPrice * line.quantity : 0;
    const externalCharge = (line.thirdPartyChargeCOP ?? 0) * line.quantity;
    if (recurring) {
      recurringServiceSubtotalValue += serviceAmount;
      recurringCharge += externalCharge;
      if (line.discountEligible) recurringEligibleSubtotal += serviceAmount;
      if (!hasValidPrice) recurringUnpriced = true;
    } else {
      oneTimeServiceSubtotalValue += serviceAmount;
      oneTimeCharge += externalCharge;
      if (line.discountEligible) oneTimeEligibleSubtotal += serviceAmount;
      if (!hasValidPrice) oneTimeUnpriced = true;
    }
  }
  const oneTimeServiceSubtotal = oneTimeUnpriced ? null : money(oneTimeServiceSubtotalValue);
  const recurringServiceSubtotal = recurringUnpriced ? null : money(recurringServiceSubtotalValue);
  const serviceSubtotalCOP = oneTimeServiceSubtotal === null || recurringServiceSubtotal === null
    ? null : oneTimeServiceSubtotal + recurringServiceSubtotal;
  const oneTimeDiscountCOP = oneTimeServiceSubtotal === null
    ? null : money(oneTimeEligibleSubtotal * alternative.discountPercent / 100);
  const recurringDiscountCOP = recurringServiceSubtotal === null
    ? null : money(recurringEligibleSubtotal * alternative.discountPercent / 100);
  const discountCOP = oneTimeDiscountCOP === null || recurringDiscountCOP === null
    ? null : oneTimeDiscountCOP + recurringDiscountCOP;
  const direct = directCosts(alternative);
  if (direct.cost === null) blockers.push('Configura los costos directos de terceros y otros costos, o registra explícitamente COP 0.');
  if (direct.charge === null) blockers.push('Configura los cargos externos trasladados al cliente, o registra explícitamente COP 0.');

  if (!validPercent(proposal.settings.targetMarginPercent)) blockers.push('El margen objetivo debe ser mayor o igual a 0 % y menor a 100 %.');
  if (!validPercent(proposal.settings.minimumAuthorizedMarginPercent, true)) blockers.push('El margen mínimo debe estar entre 0 % y 100 %.');
  if (!validPercent(proposal.settings.indirectCostPercent, true)) blockers.push('El porcentaje de costos indirectos debe estar entre 0 % y 100 %.');
  if (!validPercent(proposal.settings.contingencyPercent, true)) blockers.push('La contingencia debe estar entre 0 % y 100 %.');
  if (!validPercent(proposal.settings.maximumDiscountPercent, true)) blockers.push('El descuento máximo sujeto a aprobación debe ser menor a 100 %.');
  if (proposal.settings.taxValidationStatus !== 'validated') blockers.push('El tratamiento tributario está pendiente de validación; confirma impuestos y retenciones antes de aprobar.');
  if (alternative.lines.some((line) => (proposal.settings.taxTreatments[line.serviceId] ?? line.taxTreatment) === 'pending')) {
    blockers.push('Define si cada servicio seleccionado está gravado o excluido antes de aprobar la cotización.');
  }
  if (proposal.settings.taxValidationStatus === 'validated' && alternative.lines.some((line) =>
    (proposal.settings.taxTreatments[line.serviceId] ?? line.taxTreatment) === 'taxable',
  ) && !validPercent(proposal.settings.taxPercent, true)) blockers.push('Configura la tarifa de IVA validada para los conceptos gravados.');
  if (proposal.settings.withholdingPercent !== null && !validPercent(proposal.settings.withholdingPercent, true)) {
    blockers.push('La tarifa de retención debe estar entre 0 % y 100 %.');
  }
  if (!proposal.settings.indirectCostConfigured) {
    warnings.push('Los costos indirectos están en 0 % y sin configurar; la rentabilidad se presenta como provisional.');
  }
  if (alternative.discountPercent > proposal.settings.maximumDiscountPercent) {
    warnings.push(`El descuento supera ${proposal.settings.maximumDiscountPercent} % y requiere autorización especial declarada, responsable y justificación.`);
  }
  if (alternative.discountPercent > proposal.settings.defaultDiscountPercent) {
    warnings.push(`El descuento aplicado (${alternative.discountPercent} %) supera el predeterminado (${proposal.settings.defaultDiscountPercent} %).`);
  }
  if (!alternative.paymentTerms.trim()) blockers.push('Define las condiciones de pago.');
  if (!alternative.scheduleNote.trim()) blockers.push('Define un cronograma tentativo y sus dependencias.');
  if (!proposal.validUntil) blockers.push('Define la vigencia de la propuesta.');

  const hours = {
    optimistic: sumHours(alternative, 'optimistic'),
    base: sumHours(alternative, 'base'),
    conservative: sumHours(alternative, 'conservative'),
  };
  const laborCostCOP = {
    optimistic: laborCost(hours.optimistic, proposal),
    base: laborCost(hours.base, proposal),
    conservative: laborCost(hours.conservative, proposal),
  };
  if (Object.values(laborCostCOP).some((value) => value === null)) {
    blockers.push('Configura el costo horario interno de cada perfil utilizado; la rentabilidad no puede determinarse sin esos datos.');
  }

  const totalCostCOP = {} as Record<EstimateScenario, number | null>;
  const targetPriceCOP = {} as Record<EstimateScenario, number | null>;
  const minimumPriceAtMinimumMarginCOP = {} as Record<EstimateScenario, number | null>;
  const margin = proposal.settings.targetMarginPercent;
  for (const scenario of ['optimistic', 'base', 'conservative'] as const) {
    const labor = laborCostCOP[scenario];
    if (labor === null || direct.cost === null
      || !validPercent(proposal.settings.indirectCostPercent, true)
      || !validPercent(proposal.settings.contingencyPercent, true)) {
      totalCostCOP[scenario] = null;
      targetPriceCOP[scenario] = null;
      continue;
    }
    const indirect = labor * proposal.settings.indirectCostPercent! / 100;
    const contingencyBase = labor + direct.cost + indirect;
    const total = money(contingencyBase + contingencyBase * proposal.settings.contingencyPercent! / 100);
    totalCostCOP[scenario] = total;
    targetPriceCOP[scenario] = validPercent(margin) ? money(total / (1 - margin! / 100)) : null;
    const minimumMargin = proposal.settings.minimumAuthorizedMarginPercent;
    minimumPriceAtMinimumMarginCOP[scenario] = validPercent(minimumMargin)
      ? money(total / (1 - minimumMargin! / 100)) : null;
  }

  const taxRate = proposal.settings.taxPercent;
  oneTimeCharge = direct.charge === null ? 0 : money(oneTimeCharge);
  recurringCharge = direct.charge === null ? 0 : money(recurringCharge);
  const oneTimePreTax = direct.charge === null || oneTimeServiceSubtotal === null || oneTimeDiscountCOP === null
    ? null : oneTimeServiceSubtotal - oneTimeDiscountCOP + oneTimeCharge;
  const recurringPreTax = direct.charge === null || recurringServiceSubtotal === null || recurringDiscountCOP === null
    ? null : recurringServiceSubtotal - recurringDiscountCOP + recurringCharge;
  const taxTreatments = alternative.lines.map((line) => proposal.settings.taxTreatments[line.serviceId] ?? line.taxTreatment);
  const taxConfigurationValid = proposal.settings.taxValidationStatus === 'validated'
    && !taxTreatments.includes('pending')
    && (!taxTreatments.includes('taxable') || validPercent(taxRate, true))
    && (proposal.settings.withholdingPercent === null || validPercent(proposal.settings.withholdingPercent, true));
  const taxByTerm = (recurring: boolean): number | null => {
    if (!taxConfigurationValid) return null;
    let taxableBase = 0;
    for (const line of alternative.lines) {
      const isRecurring = line.serviceSnapshot?.recurring ?? getCommercialService(line.serviceId)?.recurring ?? false;
      if (isRecurring !== recurring || (proposal.settings.taxTreatments[line.serviceId] ?? line.taxTreatment) !== 'taxable') continue;
      const price = line.proposedUnitPriceCOP ?? 0;
      const discount = line.discountEligible ? price * alternative.discountPercent / 100 : 0;
      taxableBase += (price - discount) * line.quantity;
    }
    return money(taxableBase * (taxRate ?? 0) / 100);
  };
  const oneTimeTaxCOP = oneTimePreTax === null ? null : taxByTerm(false);
  const recurringTaxCOP = recurringPreTax === null ? null : taxByTerm(true);
  const taxCOP = oneTimeTaxCOP === null || recurringTaxCOP === null ? null : oneTimeTaxCOP + recurringTaxCOP;
  const oneTimeWithholdingCOP = oneTimePreTax === null || proposal.settings.withholdingPercent === null
    ? 0 : money(Math.max(0, oneTimePreTax - oneTimeCharge) * proposal.settings.withholdingPercent / 100);
  const recurringWithholdingCOP = recurringPreTax === null || proposal.settings.withholdingPercent === null
    ? 0 : money(Math.max(0, recurringPreTax - recurringCharge) * proposal.settings.withholdingPercent / 100);
  const withholdingCOP = oneTimePreTax === null || recurringPreTax === null
    ? null : oneTimeWithholdingCOP + recurringWithholdingCOP;
  const pretaxClientInvestmentCOP = oneTimePreTax === null || recurringPreTax === null
    ? null : oneTimePreTax + recurringPreTax;
  const oneTimeClientInvestmentCOP = oneTimePreTax === null || oneTimeTaxCOP === null
    ? null : oneTimePreTax + oneTimeTaxCOP - oneTimeWithholdingCOP;
  const recurringMonthlyInvestmentCOP = recurringPreTax === null || recurringTaxCOP === null
    ? null : recurringPreTax + recurringTaxCOP - recurringWithholdingCOP;
  const clientInvestmentCOP = oneTimeClientInvestmentCOP === null || recurringMonthlyInvestmentCOP === null
    ? null : oneTimeClientInvestmentCOP + recurringMonthlyInvestmentCOP;
  const serviceRevenue = serviceSubtotalCOP === null || discountCOP === null ? null : serviceSubtotalCOP - discountCOP;
  const baseCost = totalCostCOP.base;
  const estimatedMarginPercent = serviceRevenue === null || baseCost === null || serviceRevenue <= 0
    ? null
    : ((serviceRevenue - baseCost) / serviceRevenue) * 100;
  const conservativeHoursOverBasePercent = hours.base.total > 0
    ? ((hours.conservative.total - hours.base.total) / hours.base.total) * 100
    : null;
  const conservativeCostOverBaseCOP = totalCostCOP.base === null || totalCostCOP.conservative === null
    ? null
    : totalCostCOP.conservative - totalCostCOP.base;
  const minimumMargin = proposal.settings.minimumAuthorizedMarginPercent;
  const belowMinimumMargin = estimatedMarginPercent !== null && validPercent(minimumMargin, true)
    && estimatedMarginPercent + 0.0001 < minimumMargin!;
  const profitabilityState = estimatedMarginPercent === null || baseCost === null
    ? 'undetermined'
    : !proposal.settings.indirectCostConfigured
      ? 'provisional'
      : estimatedMarginPercent >= proposal.settings.targetMarginPercent
        ? 'favorable'
        : estimatedMarginPercent >= proposal.settings.minimumAuthorizedMarginPercent
          ? 'adjusted'
          : 'insufficient';
  const serviceEconomics = alternative.lines.map((line) => {
    const pricing = proposal.servicePricing[line.serviceId];
    let labor = 0;
    let costComplete = true;
    for (const activity of line.activitiesEstimate) {
      const profile = proposal.settings.profiles.find((item) => item.id === activity.profileId);
      if (profile?.hourlyCostCOP === null || profile?.hourlyCostCOP === undefined) {
        costComplete = false;
        break;
      }
      labor += (activity.hours.expected ?? 0) * line.quantity * profile.hourlyCostCOP;
    }
    const directCost = line.thirdPartyCostCOP === null || line.otherDirectCostCOP === null
      ? null : (line.thirdPartyCostCOP + line.otherDirectCostCOP) * line.quantity;
    const operating = directCost === null ? null
      : labor + directCost + labor * proposal.settings.indirectCostPercent / 100;
    const total = operating === null ? null
      : operating * (1 + proposal.settings.contingencyPercent / 100);
    const unitCost = total === null ? null : total / line.quantity;
    const netUnitPrice = line.proposedUnitPriceCOP === null ? null
      : line.proposedUnitPriceCOP * (1 - (line.discountEligible ? alternative.discountPercent / 100 : 0));
    const marginPercent = unitCost === null || netUnitPrice === null || netUnitPrice <= 0
      ? null : ((netUnitPrice - unitCost) / netUnitPrice) * 100;
    const targetUnitPrice = unitCost === null || !validPercent(proposal.settings.targetMarginPercent)
      ? null : money(unitCost / (1 - proposal.settings.targetMarginPercent / 100));
    const minimumUnitPrice = unitCost === null || !validPercent(proposal.settings.minimumAuthorizedMarginPercent)
      ? null : money(unitCost / (1 - proposal.settings.minimumAuthorizedMarginPercent / 100));
    return {
      serviceId: line.serviceId,
      referencePriceCOP: pricing?.referencePriceCOP ?? line.proposedUnitPriceCOP ?? 0,
      unit: pricing?.unit ?? 'Unidad',
      estimatedCostCOP: costComplete ? (unitCost === null ? null : money(unitCost)) : null,
      targetPriceCOP: targetUnitPrice,
      minimumPriceCOP: minimumUnitPrice,
      estimatedMarginPercent: marginPercent,
      belowMinimumViable: minimumUnitPrice !== null && line.proposedUnitPriceCOP !== null
        && (line.proposedUnitPriceCOP * (1 - (line.discountEligible ? alternative.discountPercent / 100 : 0))) < minimumUnitPrice,
    };
  });

  if (targetPriceCOP.base !== null && serviceSubtotalCOP !== null && serviceSubtotalCOP < targetPriceCOP.base) {
    warnings.push(`El subtotal neto de servicios (${money(serviceSubtotalCOP - (discountCOP ?? 0)).toLocaleString('es-CO')} COP) está por debajo del precio objetivo (${targetPriceCOP.base.toLocaleString('es-CO')} COP); revisa precio o alcance.`);
  }
  for (const economics of serviceEconomics) {
    if (economics.belowMinimumViable && economics.minimumPriceCOP !== null) {
      warnings.push(`${getCommercialService(economics.serviceId)?.name ?? economics.serviceId}: la tarifa de referencia/propuesta está por debajo del precio mínimo estimado de ${economics.minimumPriceCOP.toLocaleString('es-CO')} COP por ${economics.unit}; revisa alcance o precio.`);
    }
  }
  if (hours.conservative.total > hours.base.total) {
    warnings.push(`El escenario conservador requiere ${conservativeHoursOverBasePercent?.toFixed(1) ?? 'más'} % más horas que el escenario base; el costo estimado aumenta ${conservativeCostOverBaseCOP === null ? 'un importe indeterminado' : `COP ${conservativeCostOverBaseCOP.toLocaleString('es-CO')}`}. Considera este riesgo en el cronograma y precio.`);
  }
  const declaredDiscountException = proposal.discountApproval.approved
    && proposal.discountApproval.justification.trim().length >= 12
    && proposal.discountApproval.responsible.trim().length >= 2
    && !!proposal.discountApproval.declaredAt;
  if ((belowMinimumMargin || alternative.discountPercent > proposal.settings.maximumDiscountPercent)
    && !declaredDiscountException) {
    blockers.push('La excepción requiere registrar la declaración, responsable, fecha y justificación; no constituye una autorización verificable.');
  }
  if (belowMinimumMargin && declaredDiscountException) {
    warnings.push('El precio queda por debajo del margen mínimo; la excepción fue declarada localmente y no es una autorización verificable.');
  }
  if (estimatedMarginPercent !== null && estimatedMarginPercent < proposal.settings.targetMarginPercent
    && estimatedMarginPercent >= proposal.settings.minimumAuthorizedMarginPercent) {
    warnings.push('El descuento o el precio comercial deja el margen por debajo del objetivo, aunque se mantiene sobre el mínimo.');
  }
  if (direct.charge !== null && direct.charge < 0) blockers.push('Los cargos externos trasladados al cliente no pueden ser negativos.');

  return {
    optionId: alternative.id,
    hours,
    laborCostCOP,
    totalCostCOP,
    targetPriceCOP,
    minimumPriceAtMinimumMarginCOP,
    serviceSubtotalCOP,
    oneTimeServiceSubtotalCOP: oneTimeServiceSubtotal,
    recurringServiceSubtotalCOP: recurringServiceSubtotal,
    discountCOP,
    oneTimeDiscountCOP,
    recurringDiscountCOP,
    thirdPartyChargeCOP: direct.charge,
    oneTimeThirdPartyChargeCOP: direct.charge === null ? null : oneTimeCharge,
    recurringThirdPartyChargeCOP: direct.charge === null ? null : recurringCharge,
    taxCOP,
    oneTimeTaxCOP,
    recurringTaxCOP,
    oneTimeWithholdingCOP,
    recurringWithholdingCOP,
    clientInvestmentCOP,
    pretaxClientInvestmentCOP,
    withholdingCOP,
    oneTimeClientInvestmentCOP,
    recurringMonthlyInvestmentCOP,
    estimatedMarginPercent,
    profitabilityState,
    serviceEconomics,
    revenuePerExpectedHourCOP: hours.base.total > 0 && serviceSubtotalCOP !== null && discountCOP !== null
      ? money((serviceSubtotalCOP - discountCOP) / hours.base.total) : null,
    conservativeHoursOverBasePercent,
    conservativeCostOverBaseCOP,
    warnings: [...new Set(warnings)],
    blockers: [...new Set(blockers)],
    belowMinimumMargin,
  };
}

export function canApproveInternally(proposal: CommercialProposal, alternative: CommercialAlternative): boolean {
  const result = calculateAlternative(proposal, alternative);
  return result.blockers.length === 0 &&
    (result.warnings.length === 0 || proposal.internalApproval.note.trim().length >= 15);
}

export function proposalStatusForAlternative(
  proposal: CommercialProposal,
  alternative: CommercialAlternative,
): ProposalStatus {
  const result = calculateAlternative(proposal, alternative);
  if (result.blockers.length > 0) return 'estimation_incomplete';
  return 'pending_review';
}
