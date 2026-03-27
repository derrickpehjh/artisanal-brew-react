import type { AgentBean, AgentBrew, ValidationIssue } from './types.js'

const VALID_METHODS  = new Set(['V60', 'Chemex', 'AeroPress', 'French Press'])
const VALID_ROASTS   = new Set(['Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'])
const BREW_TIME_RE   = /^\d+:\d{2}$/

function issue(
  severity: 'error' | 'warning',
  entityType: 'bean' | 'brew',
  entityId: string,
  entityName: string,
  field: string,
  value: unknown,
  message: string
): ValidationIssue {
  return { severity, entityType, entityId, entityName, field, value, message }
}

export function validateBean(bean: AgentBean): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { id, name } = bean

  if (!name?.trim()) {
    issues.push(issue('error', 'bean', id, name, 'name', name, 'Bean name is empty'))
  }
  if (bean.totalGrams <= 0) {
    issues.push(issue('error', 'bean', id, name, 'totalGrams', bean.totalGrams,
      `Total grams must be positive (got ${bean.totalGrams})`))
  }
  if (bean.remainingGrams < 0) {
    issues.push(issue('error', 'bean', id, name, 'remainingGrams', bean.remainingGrams,
      `Remaining grams is negative (${bean.remainingGrams}g)`))
  }
  if (bean.remainingGrams > bean.totalGrams) {
    issues.push(issue('error', 'bean', id, name, 'remainingGrams', bean.remainingGrams,
      `Remaining (${bean.remainingGrams}g) exceeds total (${bean.totalGrams}g)`))
  }
  if (!VALID_ROASTS.has(bean.roastLevel)) {
    issues.push(issue('warning', 'bean', id, name, 'roastLevel', bean.roastLevel,
      `Unknown roast level: "${bean.roastLevel}"`))
  }
  if (bean.roastDate) {
    const d = new Date(bean.roastDate)
    if (isNaN(d.getTime())) {
      issues.push(issue('error', 'bean', id, name, 'roastDate', bean.roastDate,
        `Invalid roast date: "${bean.roastDate}"`))
    } else {
      const days = (Date.now() - d.getTime()) / 86_400_000
      if (days < 0) {
        issues.push(issue('warning', 'bean', id, name, 'roastDate', bean.roastDate,
          `Roast date is ${Math.abs(Math.round(days))} days in the future`))
      }
      if (days > 365) {
        issues.push(issue('warning', 'bean', id, name, 'roastDate', bean.roastDate,
          `Bean roasted ${Math.round(days)} days ago — likely stale`))
      }
    }
  }

  return issues
}

export function validateBrew(brew: AgentBrew): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const id   = brew.id
  const name = `${brew.beanName} (${brew.method})`

  if (!VALID_METHODS.has(brew.method)) {
    issues.push(issue('error', 'brew', id, name, 'method', brew.method,
      `Unknown brew method: "${brew.method}"`))
  }
  if (brew.rating < 1 || brew.rating > 5 || !Number.isInteger(brew.rating)) {
    issues.push(issue('error', 'brew', id, name, 'rating', brew.rating,
      `Rating must be an integer 1–5 (got ${brew.rating})`))
  }
  if (brew.dose <= 0 || brew.dose > 60) {
    issues.push(issue('error', 'brew', id, name, 'dose', brew.dose,
      `Dose ${brew.dose}g is outside reasonable range (1–60g)`))
  }
  if (brew.water <= 0 || brew.water > 1500) {
    issues.push(issue('error', 'brew', id, name, 'water', brew.water,
      `Water ${brew.water}g is outside reasonable range (1–1500g)`))
  }
  if (brew.temp < 80 || brew.temp > 100) {
    issues.push(issue('error', 'brew', id, name, 'temp', brew.temp,
      `Temperature ${brew.temp}°C is outside 80–100°C`))
  }
  if (!BREW_TIME_RE.test(brew.brewTime)) {
    issues.push(issue('error', 'brew', id, name, 'brewTime', brew.brewTime,
      `Brew time "${brew.brewTime}" does not match M:SS or MM:SS format`))
  }

  const ratio = brew.water / brew.dose
  if (ratio < 10 || ratio > 20) {
    issues.push(issue('warning', 'brew', id, name, 'ratio', `1:${ratio.toFixed(1)}`,
      `Dose/water ratio 1:${ratio.toFixed(1)} is outside typical range (1:10–1:20)`))
  }

  if (brew.ratio && !brew.ratio.startsWith('1:')) {
    issues.push(issue('warning', 'brew', id, name, 'ratioStr', brew.ratio,
      `Ratio string "${brew.ratio}" should start with "1:"`))
  }

  if (brew.extraction !== null && brew.extraction !== undefined) {
    if (brew.extraction < 14 || brew.extraction > 30) {
      issues.push(issue('error', 'brew', id, name, 'extraction', brew.extraction,
        `Extraction ${brew.extraction}% is outside plausible range (14–30%)`))
    } else if (brew.extraction < 18 || brew.extraction > 24) {
      issues.push(issue('warning', 'brew', id, name, 'extraction', brew.extraction,
        `Extraction ${brew.extraction}% is outside ideal range (18–24%)`))
    }
  }

  const brewDate = new Date(brew.date)
  if (isNaN(brewDate.getTime())) {
    issues.push(issue('error', 'brew', id, name, 'date', brew.date,
      `Invalid date: "${brew.date}"`))
  } else {
    const futureDays = (brewDate.getTime() - Date.now()) / 86_400_000
    if (futureDays > 1) {
      issues.push(issue('warning', 'brew', id, name, 'date', brew.date,
        `Brew date is ${Math.round(futureDays)} days in the future`))
    }
  }

  return issues
}

export function validateAll(beans: AgentBean[], brews: AgentBrew[]): ValidationIssue[] {
  return [
    ...beans.flatMap(validateBean),
    ...brews.flatMap(validateBrew),
  ]
}
