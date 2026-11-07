import {
  COMMERCIAL_PROFILES,
  CommercialProposal,
  CommercialRoleId,
  CommercialServiceId,
  CommercialServicePricing,
  CommercialSettings,
  createCommercialServicePricing,
  createCommercialSettings,
} from './commercial-model';
import { COMMERCIAL_SERVICES } from './commercial-catalog';

export interface CommercialConfigurationExport {
  format: 'metamag-commercial-configuration';
  version: '1.0.0';
  exportedAt: string;
  settings: CommercialSettings;
  servicePricing: Record<CommercialServiceId, CommercialServicePricing>;
}

export function exportCommercialConfiguration(proposal: CommercialProposal, now = new Date()): string {
  const payload: CommercialConfigurationExport = {
    format: 'metamag-commercial-configuration',
    version: '1.0.0',
    exportedAt: now.toISOString(),
    settings: proposal.settings,
    servicePricing: proposal.servicePricing,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseCommercialConfiguration(value: unknown): Pick<CommercialConfigurationExport, 'settings' | 'servicePricing'> {
  if (!isRecord(value) || value['format'] !== 'metamag-commercial-configuration' || value['version'] !== '1.0.0') {
    throw new Error('El archivo no es una configuración comercial Metamag compatible.');
  }
  if (!isRecord(value['settings']) || !isRecord(value['servicePricing'])) {
    throw new Error('Faltan parámetros financieros o precios de referencia.');
  }

  const settings = value['settings'];
  for (const key of [
    'indirectCostPercent', 'contingencyPercent', 'targetMarginPercent',
    'minimumAuthorizedMarginPercent', 'defaultDiscountPercent', 'maximumDiscountPercent',
  ]) {
    if (!isPercent(settings[key])) throw new Error(`El parámetro ${key} debe estar entre 0 % y 100 %.`);
  }
  if (!Number.isInteger(settings['quoteValidityDays']) || (settings['quoteValidityDays'] as number) < 1
    || (settings['quoteValidityDays'] as number) > 365) {
    throw new Error('La vigencia debe ser un número entero entre 1 y 365 días.');
  }
  if (typeof settings['indirectCostConfigured'] !== 'boolean'
    || typeof settings['suggestedPaymentTerms'] !== 'string'
    || (settings['taxValidationStatus'] !== 'pending' && settings['taxValidationStatus'] !== 'validated')
    || !isNullablePercent(settings['taxPercent'])
    || !isNullablePercent(settings['withholdingPercent'])) {
    throw new Error('Los parámetros de costos, pago o impuestos no tienen un formato válido.');
  }
  if (!Array.isArray(settings['profiles'])) throw new Error('Falta la matriz de costos por perfil.');
  for (const profile of settings['profiles']) {
    if (!isRecord(profile)
      || !COMMERCIAL_PROFILES.some((item) => item.id === profile['id'])
      || !isNullableMoney(profile['hourlyCostCOP'])
      || !isNullableMoney(profile['commercialHourlyRateCOP'])) {
      throw new Error('Hay un perfil con costo horario no válido.');
    }
  }
  if (!isRecord(settings['taxTreatments'])) throw new Error('Falta la clasificación tributaria por servicio.');
  for (const service of COMMERCIAL_SERVICES) {
    const treatment = settings['taxTreatments'][service.id];
    if (treatment !== 'taxable' && treatment !== 'excluded' && treatment !== 'pending') {
      throw new Error(`Define un tratamiento tributario válido para ${service.name}.`);
    }
  }

  const defaultPricing = createCommercialServicePricing();
  const servicePricing = {} as Record<CommercialServiceId, CommercialServicePricing>;
  for (const service of COMMERCIAL_SERVICES) {
    const saved = value['servicePricing'][service.id];
    if (!isRecord(saved) || typeof saved['unit'] !== 'string' || !saved['unit'].trim()
      || !isMoney(saved['referencePriceCOP']) || !isMoney(saved['estimatedDirectCostCOP']) || saved['status'] !== 'estimated'
      || typeof saved['lastModified'] !== 'string' || !Number.isFinite(Date.parse(saved['lastModified']))
      || typeof saved['includedScope'] !== 'string' || !Array.isArray(saved['exclusions'])
      || !saved['exclusions'].every((item) => typeof item === 'string')
      || !isRecord(saved['hoursByProfile'])) {
      throw new Error(`El precio, alcance o unidad de ${service.name} no es válido.`);
    }
    const hoursByProfile: Partial<Record<CommercialRoleId, number>> = {};
    for (const [profileId, hours] of Object.entries(saved['hoursByProfile'])) {
      if (!COMMERCIAL_PROFILES.some((profile) => profile.id === profileId) || !isMoney(hours)) {
        throw new Error(`La distribución de horas de ${service.name} contiene valores no válidos.`);
      }
      hoursByProfile[profileId as CommercialRoleId] = hours;
    }
    servicePricing[service.id] = {
      unit: saved['unit'],
      referencePriceCOP: saved['referencePriceCOP'],
      estimatedDirectCostCOP: saved['estimatedDirectCostCOP'],
      status: 'estimated',
      lastModified: saved['lastModified'],
      includedScope: saved['includedScope'],
      exclusions: [...saved['exclusions']] as string[],
      hoursByProfile: { ...defaultPricing[service.id].hoursByProfile, ...hoursByProfile },
    };
  }
  const normalizedSettings = createCommercialSettings(settings as Partial<CommercialSettings>);
  return { settings: normalizedSettings, servicePricing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNullableMoney(value: unknown): value is number | null {
  return value === null || isMoney(value);
}

function isNullablePercent(value: unknown): value is number | null {
  return value === null || isPercent(value);
}

function isPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}
