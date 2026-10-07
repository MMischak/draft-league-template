export type AvailabilityStatus = 'available' | 'questionable' | 'out' | 'suspended'

export const AVAILABILITY_META: Record<AvailabilityStatus, {
  label: string
  shortLabel: string
  color: string
  borderClass: string
  surfaceClass: string
  textClass: string
}> = {
  available: {
    label: 'Fit', shortLabel: 'FIT', color: '#236845',
    borderClass: 'border-[#0f1e3a]/10', surfaceClass: 'bg-[#fffdf7]', textClass: 'text-[#236845]',
  },
  questionable: {
    label: 'Fraglich', shortLabel: 'FRAGLICH', color: '#b66a11',
    borderClass: 'border-[#dc8a22]/40', surfaceClass: 'bg-[#fff8e8]', textClass: 'text-[#9a580b]',
  },
  out: {
    label: 'Nicht verfügbar', shortLabel: 'AUS', color: '#e93545',
    borderClass: 'border-[#e93545]/35', surfaceClass: 'bg-[#fff0f1]', textClass: 'text-[#b32131]',
  },
  suspended: {
    label: 'Gesperrt', shortLabel: 'GESPERRT', color: '#7252a3',
    borderClass: 'border-[#7252a3]/35', surfaceClass: 'bg-[#f5effc]', textClass: 'text-[#60438d]',
  },
}

export function availabilityStatus(value: string | null | undefined, isInjured = false): AvailabilityStatus {
  if (value === 'questionable' || value === 'out' || value === 'suspended') return value
  return isInjured ? 'out' : 'available'
}
