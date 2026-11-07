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
  clientInvestmentCOP: number | null;
  oneTimeClientInvestmentCOP: number | null;
  recurringMonthlyInvestmentCOP: number | null;
  estimatedMarginPercent: number | null;
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
  if (![0, 10, 15, 20].includes(alternative.discountPercent)) blockers.push('Selecciona un descuento permitido: 0 %, 10 %, 15 % o 20 %.');
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

  if (!validPercent(proposal.settings.targetMarginPercent)) blockers.push('Configura el margen objetivo (menor al 100 %) para calcular el precio objetivo.');
  if (!validPercent(proposal.settings.minimumAuthorizedMarginPercent, true)) blockers.push('Configura el margen mínimo autorizado para evaluar la tarifa preferencial.');
  if (!validPercent(proposal.settings.indirectCostPercent, true)) blockers.push('Configura el porcentaje de costos indirectos, incluso si es 0 %.');
  if (!validPercent(proposal.settings.contingencyPercent, true)) blockers.push('Configura la contingencia, incluso si es 0 %.');
  if (!validPercent(proposal.settings.taxPercent, true)) blockers.push('Configura la tasa de impuestos, incluso si es 0 %.');
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
  }

  const taxRate = proposal.settings.taxPercent;
  oneTimeCharge = direct.charge === null ? 0 : money(oneTimeCharge);
  recurringCharge = direct.charge === null ? 0 : money(recurringCharge);
  const oneTimePreTax = direct.charge === null || oneTimeServiceSubtotal === null || oneTimeDiscountCOP === null
    ? null : oneTimeServiceSubtotal - oneTimeDiscountCOP + oneTimeCharge;
  const recurringPreTax = direct.charge === null || recurringServiceSubtotal === null || recurringDiscountCOP === null
    ? null : recurringServiceSubtotal - recurringDiscountCOP + recurringCharge;
  const oneTimeTaxCOP = oneTimePreTax === null || !validPercent(taxRate, true)
    ? null : money(oneTimePreTax * taxRate! / 100);
  const recurringTaxCOP = recurringPreTax === null || !validPercent(taxRate, true)
    ? null : money(recurringPreTax * taxRate! / 100);
  const taxCOP = oneTimeTaxCOP === null || recurringTaxCOP === null ? null : oneTimeTaxCOP + recurringTaxCOP;
  const oneTimeClientInvestmentCOP = oneTimePreTax === null || oneTimeTaxCOP === null
    ? null : oneTimePreTax + oneTimeTaxCOP;
  const recurringMonthlyInvestmentCOP = recurringPreTax === null || recurringTaxCOP === null
    ? null : recurringPreTax + recurringTaxCOP;
  const clientInvestmentCOP = oneTimeClientInvestmentCOP === null || recurringMonthlyInvestmentCOP === null
    ? null : oneTimeClientInvestmentCOP + recurringMonthlyInvestmentCOP;
  const preTaxInvestment = oneTimePreTax === null || recurringPreTax === null
    ? null : oneTimePreTax + recurringPreTax;
  const baseCost = totalCostCOP.base;
  const estimatedMarginPercent = preTaxInvestment === null || baseCost === null || preTaxInvestment <= 0
    ? null
    : ((preTaxInvestment - baseCost) / preTaxInvestment) * 100;
  const conservativeHoursOverBasePercent = hours.base.total > 0
    ? ((hours.conservative.total - hours.base.total) / hours.base.total) * 100
    : null;
  const conservativeCostOverBaseCOP = totalCostCOP.base === null || totalCostCOP.conservative === null
    ? null
    : totalCostCOP.conservative - totalCostCOP.base;
  const minimumMargin = proposal.settings.minimumAuthorizedMarginPercent;
  const belowMinimumMargin = estimatedMarginPercent !== null && validPercent(minimumMargin, true)
    && estimatedMarginPercent + 0.0001 < minimumMargin!;

  if (targetPriceCOP.base !== null && serviceSubtotalCOP !== null && serviceSubtotalCOP < targetPriceCOP.base) {
    warnings.push('El subtotal de servicios está por debajo del precio objetivo calculado con la configuración interna vigente.');
  }
  if (hours.conservative.total > hours.base.total) {
    warnings.push(`El escenario conservador requiere ${conservativeHoursOverBasePercent?.toFixed(1) ?? 'más'} % más horas que el escenario base; el costo estimado aumenta ${conservativeCostOverBaseCOP === null ? 'un importe indeterminado' : `COP ${conservativeCostOverBaseCOP.toLocaleString('es-CO')}`}. Considera este riesgo en el cronograma y precio.`);
  }
  if (belowMinimumMargin && !proposal.discountApproval.approved) {
    blockers.push('El margen queda por debajo del mínimo autorizado después del descuento; requiere aprobación explícita.');
  }
  if (belowMinimumMargin && proposal.discountApproval.approved && proposal.discountApproval.justification.trim().length < 12) {
    blockers.push('Documenta una justificación de al menos 12 caracteres para la aprobación excepcional del descuento.');
  }
  if (belowMinimumMargin && proposal.discountApproval.approved && proposal.discountApproval.justification.trim().length >= 12) {
    warnings.push('El precio queda por debajo del margen mínimo autorizado; revisa la excepción y documenta su aprobación interna.');
  }
  if (direct.charge !== null && direct.charge < 0) blockers.push('Los cargos externos trasladados al cliente no pueden ser negativos.');

  return {
    optionId: alternative.id,
    hours,
    laborCostCOP,
    totalCostCOP,
    targetPriceCOP,
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
    clientInvestmentCOP,
    oneTimeClientInvestmentCOP,
    recurringMonthlyInvestmentCOP,
    estimatedMarginPercent,
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
